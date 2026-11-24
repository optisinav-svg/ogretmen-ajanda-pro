const cyclicIndex = (index, length) => {
  if (!Number.isInteger(length) || length <= 0) return 0;
  const n = Math.trunc(Number(index) || 0);
  return ((n % length) + length) % length;
};
const rowIndexFromOffset = (offset, rowHeight) => {
  if (!Number.isFinite(rowHeight) || rowHeight <= 0) return 0;
  return Math.round((Number(offset) || 0) / rowHeight);
};
const centeredRowIndex = (index, length, centerCopy = 2) => centerCopy * length + cyclicIndex(index, length);
const shouldRecenter = (rowIndex, length) => rowIndex < length || rowIndex >= length * 4;
const hourValues = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minuteValues = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
module.exports = { cyclicIndex, rowIndexFromOffset, centeredRowIndex, shouldRecenter, hourValues, minuteValues };
