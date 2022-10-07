const chunk = <T>(arr: readonly T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  let chunkIdx = -1;
  arr.forEach((elt, index) => {
    const position = index % chunkSize;
    if (position > 0) {
      chunks[chunkIdx][position] = elt;
    } else {
      chunkIdx += 1;
      chunks[chunkIdx] = [elt];
    }
  });
  return chunks;
};

export default chunk;
