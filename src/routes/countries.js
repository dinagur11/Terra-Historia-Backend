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
    console.log("S3 error name:", err.name)
    console.log("S3 error message:", err.message)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router