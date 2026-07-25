import nodemailer from 'nodemailer';

export const startEmailWorker = async (connection) => {
  const channel = await connection.createChannel();
  const queueName = 'email_queue';

  await channel.assertQueue(queueName, { durable: true });
  console.log(`📧 Email worker listening on queue: ${queueName}`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
      pass: process.env.SMTP_PASS || 'etherealpass',
    },
  });

  channel.consume(queueName, async (msg) => {
    if (msg !== null) {
      try {
        const emailData = JSON.parse(msg.content.toString());
        console.log(`📩 Processing email task to: ${emailData.to}`);

        if (process.env.SMTP_USER) {
            await transporter.sendMail({
            from: '"OwlSync" <noreply@owlsync.com>',
            to: emailData.to,
            subject: emailData.subject,
            text: emailData.text,
            html: emailData.html
            });
            console.log(`✅ Successfully sent real email to ${emailData.to}`);
        } else {
            console.log(`✅ [MOCK] Successfully processed email task to ${emailData.to}`);
        }
        channel.ack(msg);
      } catch (error) {
        console.error('❌ Error processing email task:', error);
        channel.nack(msg, false, false); 
      }
    }
  });
};
