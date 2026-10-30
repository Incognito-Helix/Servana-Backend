import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockOn = jest.fn();
const mockCreateQueue = jest.fn();
const mockWork = jest.fn();
const mockSend = jest.fn();
const mockSendEmail = jest.fn();

const mockBoss = {
  start: mockStart,
  stop: mockStop,
  on: mockOn,
  createQueue: mockCreateQueue,
  work: mockWork,
  send: mockSend,
};

const mockPgBoss = jest.fn(() => mockBoss);

jest.unstable_mockModule("pg-boss", () => ({
  PgBoss: mockPgBoss,
}));

jest.unstable_mockModule("../src/services/email.service.js", () => ({
  sendEmail: mockSendEmail,
}));

const { EMAIL_QUEUE, startEmailQueue, enqueueEmail, stopEmailQueue } =
  await import("../src/services/email-queue.service.js");

describe("email queue service", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    mockCreateQueue.mockResolvedValue(undefined);
    mockWork.mockResolvedValue(undefined);
    mockSend.mockResolvedValue("job-1");
    mockSendEmail.mockResolvedValue(true);
  });

  afterEach(async () => {
    await stopEmailQueue();
  });

  test("starts the email queue with three total attempts", async () => {
    await startEmailQueue();

    expect(mockPgBoss).toHaveBeenCalledWith({
      connectionString: process.env.DATABASE_URL,
    });

    expect(mockStart).toHaveBeenCalledTimes(1);

    expect(mockCreateQueue).toHaveBeenCalledWith(EMAIL_QUEUE, {
      retryLimit: 2,
      retryDelay: 1,
      retryBackoff: true,
      retryDelayMax: 60,
    });

    expect(mockWork).toHaveBeenCalledTimes(1);
  });

  test("does not start another worker when the queue is already running", async () => {
    const firstInstance = await startEmailQueue();
    const secondInstance = await startEmailQueue();

    expect(firstInstance).toBe(secondInstance);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockWork).toHaveBeenCalledTimes(1);
  });

  test("sends an email when the worker processes a job", async () => {
    await startEmailQueue();

    const worker = mockWork.mock.calls[0][1];

    const job = {
      id: "job-1",
      data: {
        to: "user@example.com",
        subject: "Welcome to Servana",
        text: "Welcome!",
      },
    };

    await worker([job]);

    expect(mockSendEmail).toHaveBeenCalledWith(job.data);
  });

  test("rethrows email failures so pg-boss can retry them", async () => {
    await startEmailQueue();

    const worker = mockWork.mock.calls[0][1];
    const error = new Error("Resend unavailable");

    mockSendEmail.mockRejectedValue(error);

    await expect(
      worker([
        {
          id: "job-2",
          data: { to: "user@example.com" },
        },
      ]),
    ).rejects.toThrow("Resend unavailable");
  });

  test("enqueues an email successfully", async () => {
    await startEmailQueue();

    const message = {
      to: "user@example.com",
      subject: "Test email",
      text: "Hello!",
    };

    const result = await enqueueEmail(message);

    expect(result).toBe("job-1");
    expect(mockSend).toHaveBeenCalledWith(EMAIL_QUEUE, message);
  });

  test("does not enqueue an email before the queue starts", async () => {
    await expect(enqueueEmail({ to: "user@example.com" })).rejects.toThrow(
      "Email queue has not been started.",
    );
  });

  test("stops the email queue", async () => {
    await startEmailQueue();

    await stopEmailQueue();

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  test("handles stopping an inactive queue", async () => {
    await stopEmailQueue();

    expect(mockStop).not.toHaveBeenCalled();
  });

  test("cleans up when queue startup fails", async () => {
    mockStart.mockRejectedValueOnce(new Error("Database unavailable"));

    await expect(startEmailQueue()).rejects.toThrow("Database unavailable");

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  test("requires DATABASE_URL to start the queue", async () => {
    delete process.env.DATABASE_URL;

    await expect(startEmailQueue()).rejects.toThrow(
      "DATABASE_URL is required to start the email queue.",
    );

    expect(mockStart).not.toHaveBeenCalled();
  });
});
