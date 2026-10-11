import("dotenv").config();

const env = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || "development",
};
export default env;
