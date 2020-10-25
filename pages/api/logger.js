import { handle } from "@util/logger";

export default (req, res) => {
    handle({ ...req.body, throwError: false });
    res.status(200).json({});
}
