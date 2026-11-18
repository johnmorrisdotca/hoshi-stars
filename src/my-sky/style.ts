// The sky's own style sheet, as one string. Moved out of element.ts as it was.

export const FONT = '"Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

export const STYLE = `:host{display:block;position:relative;aspect-ratio:4/5;min-height:320px;background:#05081a;color:#e6ecff;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;outline:none;font:13px/1.35 ${FONT}}
:host(:focus-visible){box-shadow:inset 0 0 0 3px var(--hoshi-focus,#8fb3ff)}
canvas.sky{position:absolute;inset:0;width:100%;height:100%;display:block}
.panel{position:absolute;top:8px;left:8px;max-width:min(19em,calc(100% - 16px));box-sizing:border-box;padding:8px 10px;background:rgba(8,12,28,.84);border:1px solid rgba(160,185,245,.28);border-radius:10px;touch-action:manipulation;cursor:default}
.head{display:flex;align-items:center;gap:10px}
.icon{width:36px;height:36px;flex:none;display:block}
.title{font-weight:600;font-size:14px}
.rows{margin:6px 0 0;padding:0;list-style:none;color:#cbd6f5}
.rows li{margin:2px 0}
.rows .dim{color:#9fb0dc}
.note{margin:6px 0 0;color:#ffd9a0}
.toggle{margin-left:auto;flex:none;min-width:32px;min-height:32px;padding:0;border:1px solid rgba(160,185,245,.35);border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.toggle:focus-visible{outline:2px solid var(--hoshi-focus,#8fb3ff)}
.panel[data-collapsed] .rows,.panel[data-collapsed] .note{display:none}
.panel[data-collapsed] .title{display:none}
.facing{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);max-width:calc(100% - 16px);box-sizing:border-box;padding:4px 12px;border-radius:999px;background:rgba(8,12,28,.62);color:#dfe7ff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.message{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#cbd6f5}
.target{position:absolute;left:50%;bottom:40px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 16px);box-sizing:border-box;padding:6px 12px;border-radius:10px;background:rgba(8,12,28,.84);border:1px solid rgba(255,226,140,.45);color:#ffe9a8;text-align:center;pointer-events:none}
.target p{margin:1px 0}
.target .more{color:#cbd6f5}
.marklist{position:absolute;width:1px;height:1px;margin:0;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;list-style:none}
[hidden]{display:none!important}`;
