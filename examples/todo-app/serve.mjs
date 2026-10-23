// Minimal static server for the example app: node serve.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const port = Number(process.argv[2] ?? 5173);
const page = await readFile(new URL("./index.html", import.meta.url));

createServer((req, res) => {
	if (req.url !== "/" && req.url !== "/index.html") return res.writeHead(404).end();
	res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page);
}).listen(port, () => console.log(`http://localhost:${port}`));
