import { GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getS3 } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";

export default async function CORS_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }

        const user = await login({ id, hash, api: "cors", path: "" });
        if (!user || !roleAuth(user.role, "admin")) {
            throw "ACCESS_DENIED";
        }

        const s3 = await getS3({});
        const bucket = process.env.AWS_BUCKET;

        if (req.method === "GET") {
            try {
                const data = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
                res.status(200).json({ rules: data.CORSRules || [] });
            } catch (err) {
                // If no CORS config exists, AWS/DigitalOcean might throw an error or return empty
                if (err.code === "NoSuchCORSConfiguration" || err.message.includes("CORS")) {
                    res.status(200).json({ rules: [] });
                } else {
                    throw err;
                }
            }
        } else if (req.method === "PUT") {
            const corsRules = [
                {
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["PUT", "POST", "GET", "HEAD", "DELETE"],
                    AllowedOrigins: ["*"],
                    ExposeHeaders: ["ETag"],
                    MaxAgeSeconds: 3000
                }
            ];

            await s3.send(new PutBucketCorsCommand({
                Bucket: bucket,
                CORSConfiguration: { CORSRules: corsRules }
            }));

            res.status(200).json({ success: true, message: "CORS configuration updated" });
        } else {
            res.setHeader("Allow", "GET, PUT");
            res.status(405).end("Method Not Allowed");
        }

    } catch (err) {
        console.error("CORS API error:", err);
        res.status(403).json({ err: getSafeError(err) });
    }
}
