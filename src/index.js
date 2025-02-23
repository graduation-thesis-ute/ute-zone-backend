import express from "express";
import dbConfig from "./configurations/dbConfig.js";
import "dotenv/config.js";
import cors from "cors";
import { corsOptions } from "./static/constant.js";
import { createServer } from "http";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

app.use(cors(corsOptions));
app.use(express.json({ limit: "200mb" }));

// app.use(express.static(path.join(__dirname, "../public")));
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "../public/index.html"));
// });

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
dbConfig();
