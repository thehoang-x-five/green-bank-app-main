import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import type { UtilityFormData } from "./utilityTypes";

type Props = {
  formData: UtilityFormData;
  setFormData: React.Dispatch<React.SetStateAction<UtilityFormData>>;
};

export default function UtilityHotel({ formData, setFormData }: Props) {
  return (
    <>
      <div className="space-y-2">
        <Label>
          Thành phố / Khu vực <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="VD: Đà Nẵng"
          value={formData.hotelCity}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelCity: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>
          Ngày nhận phòng <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          value={formData.hotelCheckIn}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelCheckIn: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>
          Ngày trả phòng <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          value={formData.hotelCheckOut}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelCheckOut: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Số khách</Label>
        <Input
          type="number"
          min={1}
          value={formData.hotelGuests}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelGuests: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Số phòng</Label>
        <Input
          type="number"
          min={1}
          value={formData.hotelRooms}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, hotelRooms: e.target.value }))
          }
        />
      </div>

      <Button type="submit" className="w-full mt-2">
        Tiếp tục
      </Button>
    </>
  );
}
