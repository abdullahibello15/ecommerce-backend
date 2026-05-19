import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 10000;

// Catch any unhandled errors at startup
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});

try {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`JWT_SECRET set: ${!!process.env.JWT_SECRET}`);
    console.log(`DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
  });
} catch (err) {
  console.error("FAILED TO START SERVER:", err);
  process.exit(1);
}
