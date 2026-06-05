type SpecialCharacterHelperProps = {
  characters: string[];
  onPick: (character: string) => void;
};

export default function SpecialCharacterHelper({ characters, onPick }: SpecialCharacterHelperProps) {
  if (!characters.length) return null;

  return (
    <div className="characterChips" aria-label="Special characters">
      <span>Special characters</span>
      {characters.map((character) => (
        <button type="button" key={character} onClick={() => onPick(character)}>
          {character}
        </button>
      ))}
    </div>
  );
}
