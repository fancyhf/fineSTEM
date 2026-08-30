interface SealProps {
  no: number | string;
  large?: boolean;
}

/** 朱砂印章：集数标识，频道视觉锚点 */
export default function Seal({ no, large }: SealProps) {
  return (
    <span className={`seal${large ? ' seal--lg' : ''}`} aria-label={`第 ${no} 集`}>
      {no}
    </span>
  );
}
