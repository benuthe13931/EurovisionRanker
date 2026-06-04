import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Song } from "../types";
import SongRow from "./SongRow";

type RankingListProps = {
  songs: Song[];
  onReorder: (songs: Song[]) => void;
  favorites: Set<string>;
  onToggleFavorite: (songId: string) => void;
  metaMode?: "country" | "countryYear" | "year";
};

export default function RankingList({
  songs,
  onReorder,
  favorites,
  onToggleFavorite,
  metaMode = "country",
}: RankingListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = songs.findIndex((song) => song.id === active.id);
    const newIndex = songs.findIndex((song) => song.id === over.id);
    onReorder(arrayMove(songs, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={songs.map((song) => song.id)} strategy={verticalListSortingStrategy}>
        <div className="rankingList">
          {songs.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              rank={index + 1}
              favorite={favorites.has(song.id)}
              onToggleFavorite={onToggleFavorite}
              metaMode={metaMode}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
