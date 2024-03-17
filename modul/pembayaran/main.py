from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes


async def hello(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(f'Alaikumsalam {update.effective_user.first_name}')


app = ApplicationBuilder().token("2032581603:AAGHMttdgcfoeq-FpZXzsB5YaktSrqlDYFU").build()

app.add_handler(CommandHandler("assalamuallaykum", hello))

app.run_polling()