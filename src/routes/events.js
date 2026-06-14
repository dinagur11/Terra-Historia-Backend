import { Router } from "express"
import { getJsonFromS3 } from "../services/S3.js"

const router = Router()

router.get("/:year", async (req, res) => {
  const { year } = req.params

  if (isNaN(year)) {
    return res.status(400).json({ error: "Year must be a number" })
  }

  try {
    const data = await getJsonFromS3(process.env.S3_EVENTS_BUCKET, `${year}.json`)
    res.json(data)
  } catch (err) {
    if (err.name === "NoSuchKey") {
      return res.status(404).json({ error: `No events found for year ${year}` })
    }
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router