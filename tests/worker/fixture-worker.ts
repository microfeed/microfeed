export default {
  fetch(): Response {
    return new Response("Worker test fixture");
  },
} satisfies ExportedHandler<Env>;
