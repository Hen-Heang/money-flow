export function getKstMonthAndDay() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return {
    month: kst.toISOString().slice(0, 7),
    day: kst.getUTCDate(),
  }
}
