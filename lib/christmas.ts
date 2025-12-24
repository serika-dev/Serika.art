export function isChristmasTime(): boolean {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed, 11 is December
  const date = now.getDate();
  
  // Check if it's December 24th or 25th
  return month === 11 && (date === 24 || date === 25);
}
