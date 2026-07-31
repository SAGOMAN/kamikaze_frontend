/**
 * Shims de tipos para plugins FullCalendar.
 * Evita TS7016 en el language service cuando la resolución de `exports.types` falla.
 */
declare module '@fullcalendar/daygrid' {
  import type { PluginDef } from '@fullcalendar/core';
  const dayGridPlugin: PluginDef;
  export default dayGridPlugin;
}

declare module '@fullcalendar/timegrid' {
  import type { PluginDef } from '@fullcalendar/core';
  const timeGridPlugin: PluginDef;
  export default timeGridPlugin;
}

declare module '@fullcalendar/interaction' {
  import type { PluginDef } from '@fullcalendar/core';
  const interactionPlugin: PluginDef;
  export default interactionPlugin;
}
