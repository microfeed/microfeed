import mailChannelsPlugin from "@cloudflare/pages-plugin-mailchannels";

export const onRequest: PagesFunction = (context) =>
  mailChannelsPlugin({
    personalizations: [
      {
        to: [{ name: "ACME Support", email: `${context.env.RECEIVER_EMAIL}` }],
      },
    ],
    from: {
      name: "Contact Us Form Inquiry",
      email: `${context.env.SENDER_EMAIL}`,
    },
    respondWith: () => {
      return new Response(
        `Thank you for submitting your inquiry. A member of the team will be in touch shortly.`
      );
    },
  })(context);
