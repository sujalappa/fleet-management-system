/**
 * Sets a new password for a dashboard user.
 *
 * Usage: node scripts/setPassword.js <username> <new-password>
 * Example: node scripts/setPassword.js admin "a-long-unique-password"
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import User from "../model/userSchema.js";

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: node scripts/setPassword.js <username> <new-password>");
    process.exitCode = 1;
    return;
  }
  if (password.length < 10) {
    console.error("Use at least 10 characters — this dashboard is reachable from the internet.");
    process.exitCode = 1;
    return;
  }

  await connectDB();
  const result = await User.updateOne({ username }, { $set: { password: await bcrypt.hash(password, 10) } });
  console.log(result.matchedCount ? `Password updated for "${username}".` : `No user "${username}".`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Failed:", error.message);
  process.exitCode = 1;
});
