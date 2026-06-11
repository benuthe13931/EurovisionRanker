type FlagEmojiProps = {
  alt?: string;
  className?: string;
  code?: string;
  src?: string;
};

export default function FlagEmoji({ alt = "", className = "", code, src }: FlagEmojiProps) {
  if (src?.startsWith("/assets/")) {
    return <img className={`emojiFlag ${className}`.trim()} src={src} alt={alt} loading="lazy" />;
  }

  return <span className={className}>{code}</span>;
}
