import { Router } from "express"
import { getJsonFromS3 } from "../services/s3.js"

const router = Router()
router.get("/", async (req, res) => {
  try {
    const data = await getJsonFromS3(
      process.env.S3_DEEPDIVES_BUCKET,
      "deepdives-index.json"
    );

    res.json(data);
  } catch (err) {
    console.error("Deep Dives index S3 error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:deepdive", async (req, res) => {
  const { deepdive } = req.params

  try {
    const data = await getJsonFromS3(
      process.env.S3_DEEPDIVES_BUCKET,
      `${deepdive.toLowerCase().replace(/\s+/g, "-")}.json`
    )
    res.json(data)
  } catch (err) {
    console.error("Deep Dive S3 error:", err)

    if (err.name === "NoSuchKey") {
      return res.status(404).json({ error: `No deep dive found for ${deepdive}` })
    }

    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
