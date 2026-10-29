import { afterEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  boost: {
    findFirst: jest.fn(),
  },
  profileEvent: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  default: mockPrisma,
}));

const {
  findActiveBoostId,
  recordProfileEvent,
  VIEW_DEDUPE_WINDOW_MS,
} = await import("../src/services/profile-event.service.js");

describe("Profile event service", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("finds the active boost for a profile", async () => {
    mockPrisma.boost.findFirst.mockResolvedValue({ id: "boost-1" });

    await expect(findActiveBoostId("profile-1")).resolves.toBe("boost-1");

    expect(mockPrisma.boost.findFirst).toHaveBeenCalledWith({
      where: {
        profileId: "profile-1",
        status: "active",
        startAt: { lte: expect.any(Date) },
        endAt: { gte: expect.any(Date) },
      },
      orderBy: { type: "asc" },
      select: { id: true },
    });
  });

  it("returns null when there is no active boost", async () => {
    mockPrisma.boost.findFirst.mockResolvedValue(null);

    await expect(findActiveBoostId("profile-1")).resolves.toBeNull();
  });

  it("records an event with its type, viewer, and active boost", async () => {
    mockPrisma.boost.findFirst.mockResolvedValue({ id: "boost-1" });
    mockPrisma.profileEvent.create.mockResolvedValue({ id: "event-1" });

    await recordProfileEvent({
      profileId: "profile-1",
      type: "impression",
      viewerId: "viewer-1",
    });

    expect(mockPrisma.profileEvent.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        type: "impression",
        boostId: "boost-1",
        viewerId: "viewer-1",
      },
    });
  });

  it("records a view when no recent duplicate exists", async () => {
    mockPrisma.boost.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.create.mockResolvedValue({ id: "event-1" });

    await recordProfileEvent({
      profileId: "profile-1",
      type: "view",
      viewerId: "viewer-1",
    });

    expect(mockPrisma.profileEvent.findFirst).toHaveBeenCalledWith({
      where: {
        profileId: "profile-1",
        type: "view",
        viewerId: "viewer-1",
        createdAt: { gte: expect.any(Date) },
      },
      select: { id: true },
    });

    expect(mockPrisma.profileEvent.create).toHaveBeenCalledTimes(1);
    expect(VIEW_DEDUPE_WINDOW_MS).toBe(30 * 60 * 1000);
  });

  it("suppresses a duplicate view within the deduplication window", async () => {
    mockPrisma.boost.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.findFirst.mockResolvedValue({ id: "existing-event" });

    await expect(
      recordProfileEvent({
        profileId: "profile-1",
        type: "view",
        viewerId: "viewer-1",
      }),
    ).resolves.toBeNull();

    expect(mockPrisma.profileEvent.create).not.toHaveBeenCalled();
  });

  it("does not suppress views for different authenticated viewers", async () => {
    mockPrisma.boost.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.create.mockResolvedValue({ id: "event-1" });

    await recordProfileEvent({
      profileId: "profile-1",
      type: "view",
      viewerId: "viewer-2",
    });

    expect(mockPrisma.profileEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ viewerId: "viewer-2" }),
      }),
    );
    expect(mockPrisma.profileEvent.create).toHaveBeenCalledTimes(1);
  });

  it("records anonymous views without applying viewer-based deduplication", async () => {
    mockPrisma.boost.findFirst.mockResolvedValue(null);
    mockPrisma.profileEvent.create.mockResolvedValue({ id: "event-1" });

    await recordProfileEvent({
      profileId: "profile-1",
      type: "view",
    });

    expect(mockPrisma.profileEvent.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.profileEvent.create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        type: "view",
        boostId: null,
        viewerId: null,
      },
    });
  });
});