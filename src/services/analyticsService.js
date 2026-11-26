import { USE_MOCK, request } from "./api";
import { getPapersSync } from "./paperService";
import { getQuestionsSync } from "./questionService";
import { computeAnalytics } from "../shared/analytics.js";
import { sleep } from "../utils/helpers";

export { computeAnalytics };

export async function getAnalytics(user) {
  if (!USE_MOCK) return request("/analytics");
  await sleep(350);
  return computeAnalytics(getPapersSync(user), getQuestionsSync());
}
