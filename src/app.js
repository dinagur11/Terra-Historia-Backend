import 'dotenv/config'
import express from "express"
import cors from "cors"
import eventsRouter from "./routes/events.js"
import countriesRouter from "./routes/countries.js"
import usersRouter from "./routes/users.js"
import deepDivesRouter from "./routes/deep-dives.js"
import suggestionsRouter from "./routes/suggestions.js"
const app = express()

app.use(cors({ origin: 'https://main.d16d5gmih31530.amplifyapp.com' }));
app.use(express.json())

app.use("/events", eventsRouter)
app.use("/countries", countriesRouter)
app.use("/users", usersRouter)
app.use("/deepdives", deepDivesRouter)
app.use("/suggestions", suggestionsRouter)

app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
