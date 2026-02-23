import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const port = Number(process.env.PORT) || 5005;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
