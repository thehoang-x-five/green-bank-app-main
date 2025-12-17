import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Seat } from "@/services/cinemaService";

interface SeatMapProps {
  seats: Seat[];
  onSelectionChange: (selectedSeats: string[]) => void;
  maxSeats?: number;
}

export function SeatMap({ seats, onSelectionChange, maxSeats = 10 }: SeatMapProps) {
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());

  const handleSeatClick = (seat: Seat) => {
    if (seat.status === "occupied") {
      return;
    }

    const newSelected = new Set(selectedSeats);
    
    if (newSelected.has(seat.id)) {
      // Deselect
      newSelected.delete(seat.id);
    } else {
      // Check max seats limit
      if (newSelected.size >= maxSeats) {
        return;
      }
      // Select
      newSelected.add(seat.id);
    }

    setSelectedSeats(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  const getSeatStatus = (seat: Seat): "available" | "occupied" | "selected" => {
    if (seat.status === "occupied") return "occupied";
    if (selectedSeats.has(seat.id)) return "selected";
    return "available";
  };

  const getSeatColor = (status: "available" | "occupied" | "selected") => {
    switch (status) {
      case "available":
        return "bg-gray-200 hover:bg-gray-300 cursor-pointer";
      case "occupied":
        return "bg-red-400 cursor-not-allowed";
      case "selected":
        return "bg-green-500 hover:bg-green-600 cursor-pointer";
    }
  };

  // Group seats by row
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const seatsByRow = rows.map(row => 
    seats.filter(seat => seat.row === row)
  );

  return (
    <div className="space-y-4">
      {/* Screen */}
      <div className="text-center mb-6">
        <div className="inline-block bg-gray-800 text-white px-8 py-2 rounded-t-lg">
          Màn hình
        </div>
      </div>

      {/* Seat Grid */}
      <div className="space-y-2">
        {seatsByRow.map((rowSeats, idx) => (
          <div key={rows[idx]} className="flex items-center gap-2">
            {/* Row label */}
            <div className="w-8 text-center font-semibold text-gray-700">
              {rows[idx]}
            </div>
            
            {/* Seats */}
            <div className="flex gap-2 flex-1 justify-center">
              {rowSeats.map(seat => {
                const status = getSeatStatus(seat);
                return (
                  <Button
                    key={seat.id}
                    variant="outline"
                    size="sm"
                    className={`w-10 h-10 p-0 ${getSeatColor(status)}`}
                    onClick={() => handleSeatClick(seat)}
                    disabled={status === "occupied"}
                  >
                    {seat.number}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <Card className="p-4">
        <div className="flex gap-6 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 border rounded"></div>
            <span>Trống</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 border rounded"></div>
            <span>Đã chọn</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-400 border rounded"></div>
            <span>Đã đặt</span>
          </div>
        </div>
      </Card>

      {/* Selection summary */}
      {selectedSeats.size > 0 && (
        <Card className="p-4 bg-blue-50">
          <div className="text-sm">
            <span className="font-semibold">Ghế đã chọn:</span>{" "}
            {Array.from(selectedSeats).sort().join(", ")}
            <span className="ml-2 text-gray-600">
              ({selectedSeats.size}/{maxSeats} ghế)
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
