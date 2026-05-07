import { Router } from "express"
import { getJsonFromS3 } from "../services/s3.js"

const router = Router()

router.get("/:country", async (req, res) => {
  const { country } = req.params

  try {
    const data = await getJsonFromS3(
      process.env.S3_COUNTRIES_BUCKET,
      `${country.toLowerCase().replace(/\s+/g, "-")}.json`
    )
    res.json(data)
  } catch (err) {
    console.error("Country S3 error:", err)

    if (err.name === "NoSuchKey") {
      return res.status(404).json({ error: `No country found for ${country}` })
    }

    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
