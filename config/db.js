const mongoose = require("mongoose");
const dns = require("node:dns");

const fallbackDnsServers = ["1.0.0.1", "1.1.1.1"];
const isSrvDnsError = (error) =>
  /querySrv/i.test(error?.message || "") &&
  ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEOUT"].includes(error?.code);

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is required. Set it to your MongoDB connection string.");
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri) || /[<>]/.test(mongoUri)) {
    throw new Error("MONGODB_URI is not a valid MongoDB connection string.");
  }

  const originalDnsServers = dns.getServers();
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log("MongoDB connected successfully");
  } catch (error) {
    if (!/^mongodb\+srv:\/\//i.test(mongoUri) || !isSrvDnsError(error)) {
      throw error;
    }

    let lastError = error;
    for (const dnsServer of fallbackDnsServers) {
      try {
        dns.setServers([dnsServer]);
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
        console.warn(`MongoDB DNS lookup succeeded using fallback resolver ${dnsServer}`);
        console.log("MongoDB connected successfully");
        return;
      } catch (retryError) {
        lastError = retryError;
        if (!isSrvDnsError(retryError)) {
          dns.setServers(originalDnsServers);
          throw retryError;
        }
      }
    }

    dns.setServers(originalDnsServers);
    throw lastError;
  }
};

module.exports = connectDB;
