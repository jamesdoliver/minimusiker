interface ClassSongCountProps {
  classCount: number;
  songCount: number;
}

export function ClassSongCount({ classCount, songCount }: ClassSongCountProps) {
  const isEmpty = classCount === 0 && songCount === 0;

  return (
    <span className={`text-sm font-medium ${isEmpty ? 'text-gray-400' : 'text-gray-700'}`}>
      {classCount}/{songCount}
    </span>
  );
}
