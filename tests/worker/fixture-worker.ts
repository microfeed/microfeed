export default {
  fetch(): Response {
    return new Response("Worker test fixture");
  },
  queue(batch): void {
    for (const message of batch.messages) message.ack();
  },
} satisfies ExportedHandler<Env>;
