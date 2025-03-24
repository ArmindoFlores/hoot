import os
import smtplib
import ssl
import traceback
import typing
from email import encoders
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


class EmailClient:
    def __init__(self, user: str, password: str, server: str, port: int, name: typing.Optional[str] = None):
        self._email_user = user
        self._email_password = password
        self._email_name = name or self._email_user
        self._email_server = server
        self._email_port = port
        
    def send_email(self, subject: str, body_text: str, body_html: str, recipient: str, attachment_file_path: typing.Optional[str] = None, image_folder_path: typing.Optional[str] = None):
        msg = MIMEMultipart("related")
        msg["From"] = self._email_name
        msg["To"] = recipient
        msg["Subject"] = subject
    
        # Create an alternative part for plain text and HTML content
        msg_alternative = MIMEMultipart("alternative")
        msg.attach(msg_alternative)

        # Attach plain text part
        msg_alternative.attach(MIMEText(body_text, "plain"))

        # Attach the HTML part
        msg_alternative.attach(MIMEText(body_html, "html"))

        # Embed images from the image folder
        if image_folder_path is not None:
            for image_name in os.listdir(image_folder_path):
                image_path = os.path.join(image_folder_path, image_name)
                with open(image_path, "rb") as img:
                    mime_image = MIMEImage(img.read())
                    mime_image.add_header("Content-ID", f"<{image_name}>")
                    mime_image.add_header("Content-Disposition", "inline", filename=image_name)
                    msg.attach(mime_image)

        # Attach a file if provided
        if attachment_file_path is not None and os.path.exists(attachment_file_path):
            filename = os.path.basename(attachment_file_path)
            attachment = open(attachment_file_path, "rb")

            # Create a MIMEBase instance
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename={filename}")

            # Attach the file to the email
            msg.attach(part)
            attachment.close()

        try:
            # Connect to email's SMTP server
            if self._email_port == 587:
                server = smtplib.SMTP(self._email_server, self._email_port)
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            else:
                server = smtplib.SMTP_SSL(self._email_server, self._email_port)
            server.login(self._email_user, self._email_password)

            # Send the email
            text = msg.as_string()
            server.sendmail(self._email_user, recipient, text)
        except Exception:
            traceback.print_exc()
            return False
        finally:
            server.quit()
        return True
