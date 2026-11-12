
const mongoose = require("mongoose");
const dns = require("node:dns");

const fallbackDnsServers = ["1.1.1.1", "8.8.8.8"];
const isSrvDnsError = (error) =>
    /querySrv/i.test(error?.message || "") &&
    ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEOUT"].includes(error?.code);

const connectWithSrvDnsFallback = async (mongoUri) => {
    try {
        return await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    } catch (error) {
        if (!isSrvDnsError(error)) throw error;

        let lastError = error;
        const originalDnsServers = dns.getServers();

        for (const dnsServer of fallbackDnsServers) {
            try {
                // Some Windows/managed DNS resolvers reject SRV queries; retry the
                // Atlas lookup with a public resolver before giving up.
                dns.setServers([dnsServer]);
                const connection = await mongoose.connect(mongoUri, {
                    serverSelectionTimeoutMS: 15000,
                });
                console.warn(`MongoDB SRV lookup succeeded using fallback DNS ${dnsServer}`);
                return connection;
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

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI;

    // Check whether MongoDB URI exists
    if (!mongoUri) {
        throw new Error(
            "MONGODB_URI is required. Set it to your MongoDB Atlas connection string."
        );
    }

    // Validate MongoDB connection string
    if (
        !/^mongodb(?:\+srv)?:\/\//i.test(mongoUri) ||
        /[<>]/.test(mongoUri)
    ) {
        throw new Error(
            "MONGODB_URI is not a valid MongoDB connection string."
        );
    }

    try {
        await connectWithSrvDnsFallback(mongoUri);

        console.log("MongoDB connected successfully");

    } catch (error) {
        if (/ENOTFOUND|EAI_AGAIN|querySrv/i.test(error.message)) {
            throw new Error(
                "MongoDB Atlas DNS lookup failed. Verify your cluster hostname.",
                { cause: error }
            );
        }

        throw error;
    }
};

module.exports = connectDB;
