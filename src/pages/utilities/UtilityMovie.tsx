import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import type { UtilityFormData } from "./utilityTypes";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;
};

export default function UtilityMovie({ formData, setFormData }: Props) {
  return (
    <>
      <div className="space-y-2">
        <Label>
          Rạp chiếu <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: CGV Vincom Landmark"
          value={formData.movieCinema}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieCinema: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>
          Tên phim <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: Avengers: Endgame"
          value={formData.movieName}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieName: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>
          Ngày chiếu <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          value={formData.movieDate}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieDate: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>
          Suất chiếu <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: 19:30"
          value={formData.movieTime}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieTime: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Số lượng vé</Label>
        <Input
          type="number"
          min={1}
          value={formData.movieTickets}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, movieTickets: e.target.value }))
          }
        />
      </div>

      <Button type="submit" className="w-full mt-2">
        Tiếp tục
      </Button>
    </>
  );
}
