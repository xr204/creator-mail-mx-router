import { createServer } from "node:http";
import { ZodError } from "zod";
import { configureCreatorMail } from "./configure_creator_mail.js";
import { InfraiError, infraiFromEnvironment } from "./infrai_client.js";

const infrai = infraiFromEnvironment();
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/creator-mail/configure") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const rawInput: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    send(response, 200, await configureCreatorMail(rawInput, infrai));
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid creator mail request", issues: error.issues });
    } else if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.message,
        code: error.code
      });
    } else if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be valid JSON" });
    } else {
      send(response, 500, { error: "Could not configure creator mail" });
    }
  }
}).listen(port, () => console.log(`Creator mail service listening on http://localhost:${port}`));

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
