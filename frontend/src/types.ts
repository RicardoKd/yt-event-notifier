export interface Group {
  id: number;
  timezone: string;
  reminder_hours: number;
  check_window_hours: number;
  auto_create: boolean;
  broadcast_privacy: 'public' | 'unlisted' | 'private';
  broadcast_description: string;
  broadcast_made_for_kids: boolean;
  yt_channel_name?: string;
  yt_channel_id?: string;
}

export interface Slot {
  id: number;
  group_id: number;
  day_of_week: number;
  local_time: string;
  title_template: string;
  custom_message: string | null;
}

export interface Stream {
  id: number;
  scheduled_start: number;
  status: string;
  yt_url: string | null;
}
