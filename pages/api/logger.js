import { handle } from "@util/logger";

export default function LOGGER_API(req, res) {
    handle({ ...req.body, throwError: false });
    res.status(200).json({});
}
