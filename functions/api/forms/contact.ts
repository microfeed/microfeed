export const onRequest = async ({ request, env }) => {
  const recipientEmail = env.RECEIVER_EMAIL; // 自分のメールアドレス
  const sender = env.SENDER_NAME; // 自分の名前や会社名
  const senderEmail = env.SENDER_EMAIL; // 送信に使うメールアドレス（ドメインが同じなら適当でも可）
  const formData = await request.formData(); // クライアントサイドから送られたフォームデータを取得
  const name = formData.get("name"); // フォームデータの中身
  const email = formData.get("email"); // フォームデータの中身
  const detail = formData.get("detail"); // フォームデータの中身

  const toAdminRes = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: recipientEmail }],
        },
      ],
      from: { email: senderEmail, name: sender },
      subject: "お問い合わせがありました",
      content: [
        {
          type: "text/plain",
          value: `【お名前】\n${name}様\n【メールアドレス】\n${email}\n【お問い合わせ内容】\n${detail}`,
        },
      ],
    }),
  });

  if (toAdminRes.ok) {
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email }],
          },
        ],
        from: { email: senderEmail, name: sender },
        subject: "お問い合わせありがとうございます",
        content: [
          {
            type: "text/plain",
            value: `${name}様\nこの度はお問い合わせいただきありがとうございます。(略)\n【お問い合わせ内容】\n${detail}`,
          },
        ],
      }),
    });

    return new Response("送信に成功しました！", { status: 200 });
  }

  return new Response("送信に失敗しました。", { status: 500 });
};