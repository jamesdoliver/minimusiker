interface StatsPillProps {
  icon: 'classes' | 'children' | 'parents';
  value: number;
  label: string;
}

const icons: Record<StatsPillProps['icon'], string> = {
  classes: '📚',
  children: '👶',
  parents: '👨‍👩‍👧',
};

export default function StatsPill({ icon, value, label }: StatsPillProps) {
  return (
    <div className="bg-[#94B8B3]/10 border border-[#94B8B3]/20 rounded-lg px-3 py-2 text-center min-w-[70px]">
      <div className="text-lg">{icons[icon]}</div>
      <div className="text-lg font-bold text-[#5a8a82]">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}
