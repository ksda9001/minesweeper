export type Language = 'zh' | 'en';
export type LanguageOption = 'auto' | Language;
export function systemLanguage(): Language { return (navigator.languages?.[0] ?? navigator.language).toLowerCase().startsWith('zh') ? 'zh' : 'en'; }
const zh = {
  title: '草地扫雷', game: '游戏', difficulty: '难度', beginner: '基础', intermediate: '中级', expert: '专家', custom: '自定义', settings: '设置', help: '帮助',
  remaining: '剩余地雷', timer: '时间（秒）', restart: '重新开始', loading: '正在准备草地…', loadingDetail: '三维地形 · 植被 · 日光', renderUnavailable: '三维渲染暂不可用', renderError: '无法初始化三维渲染：', reload: '重新加载',
  seconds: '秒', minesUnit: '雷',
  flagMode: '插旗模式', revealMode: '翻开模式', recenter: '归位', enableMotion: '开启姿态', disableMotion: '关闭姿态', close: '关闭',
  portraitHint: '手机上横向雷区会转为竖向，格数和地雷数保持不变。',
  customTitle: '自定义雷区', customIntro: '仍然是经典规则，只调整雷区大小。', width: '宽度', height: '高度', mines: '地雷数量', customHint: '边长至少 5，长边最多 40，短边最多 30。首次点击的 3×3 区域保留安全空间。', start: '开始游戏',
  graphics: '画面', quality: '画质', autoQuality: '自动 · 实测帧率', low: '低', medium: '中', high: '高', ultra: '极高', reducedMotion: '减少动画与感应光影', contrast: '高对比度数字',
  motion: '感应光影', intensity: '光影强度', sensitivity: '灵敏度', audio: '声音', master: '总音量', effects: '操作音效', ambient: '环境风声', shortcuts: '启用键盘快捷键',
  language: '语言', system: '跟随系统', settingsHint: '设置仅保存在本机。', storageError: '浏览器未允许本地存储；当前设置仍然有效。',
  helpTitle: '玩法说明', helpIntro: '翻开所有没有地雷的格子即可获胜。数字表示周围八格的地雷数量。',
  reveal: '翻开', revealHelp: '左键 / 轻触。首次点击及相邻格不会有雷。', flag: '插旗', flagHelp: '右键 / 长按 450 毫秒，或切换插旗模式。', chord: '数字连开', chordHelp: '已插旗数量等于数字时，点击该数字自动翻开剩余邻格。插错旗可能踩雷。',
  camera: '移动视角', cameraHelp: '拖动平移，滚轮或双指缩放。设置中的「归位」恢复视角并校准姿态。', keyboard: '键盘', keyboardHelp: '方向键选格；Enter / 空格翻开；F 插旗；C 连开；R 重开；Home 归位。',
  helpHint: '计时从第一次翻开开始，胜负后停止；切换到后台仍计入本局时间。通关后，模式和用时自动记入计分板。', offline: '离线', offlineReady: '离线就绪', local: '本地',
  scores: '计分板', scoreMode: '模式', scoreTime: '用时', scoreDate: '完成日期', scoreHint: '记录每次成功通关的模式和用时，保存在本机。', scoreEmpty: '还没有通关记录。', scoreStorageError: '未能保存成绩；当前会话仍可查看本次记录。',
  board: '扫雷游戏', navigation: '游戏菜单', columns: '列', rows: '行', cell: '格', covered: '未翻开', revealed: '已翻开', flagged: '已插旗', mine: '地雷', empty: '空白', adjacent: '相邻地雷',
};
const en: typeof zh = {
  title: 'Realistic Minesweeper', game: 'Game', difficulty: 'Difficulty', beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert', custom: 'Custom', settings: 'Settings', help: 'Help',
  remaining: 'Mines remaining', timer: 'Time (seconds)', restart: 'New game', loading: 'Preparing your field…', loadingDetail: 'Terrain · Vegetation · Daylight', renderUnavailable: '3D rendering unavailable', renderError: 'Unable to initialize 3D: ', reload: 'Reload',
  seconds: 's', minesUnit: 'mines',
  flagMode: 'Flag mode', revealMode: 'Reveal mode', recenter: 'Recenter', enableMotion: 'Enable tilt', disableMotion: 'Disable tilt', close: 'Close',
  portraitHint: 'Wide fields rotate to portrait on phones, preserving the cell and mine counts.',
  customTitle: 'Custom field', customIntro: 'Classic rules, your field dimensions.', width: 'Width', height: 'Height', mines: 'Mines', customHint: 'Sides at least 5, longer side up to 40, shorter side up to 30. The first opening reserves a safe 3×3 area.', start: 'Start game',
  graphics: 'Graphics', quality: 'Quality', autoQuality: 'Auto · Measured FPS', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra', reducedMotion: 'Reduce animations and tilt lighting', contrast: 'High-contrast numbers',
  motion: 'Tilt lighting', intensity: 'Lighting intensity', sensitivity: 'Sensitivity', audio: 'Sound', master: 'Master volume', effects: 'Effects', ambient: 'Ambient wind', shortcuts: 'Enable keyboard shortcuts',
  language: 'Language', system: 'Follow system', settingsHint: 'Settings stay on this device.', storageError: 'Local storage is unavailable. Your settings still work for this session.',
  helpTitle: 'How to play', helpIntro: 'Reveal every safe patch to win. Each number counts mines in the eight surrounding cells.',
  reveal: 'Reveal', revealHelp: 'Left-click or tap. The first patch and its neighbors are safe.', flag: 'Flag', flagHelp: 'Right-click, hold for 450 ms, or turn on Flag mode.', chord: 'Chord a number', chordHelp: 'When adjacent flags match a revealed number, click it to open the other neighbors. Incorrect flags can trigger a mine.',
  camera: 'Move the view', cameraHelp: 'Drag to pan. Scroll or pinch to zoom. Recenter in Settings restores the view and recalibrates tilt.', keyboard: 'Keyboard', keyboardHelp: 'Arrows: select; Enter / Space: reveal; F: flag; C: chord; R: restart; Home: recenter.',
  helpHint: 'The timer starts at the first reveal and stops on win or loss. Time in the background counts. Each cleared field adds its mode and time to Scores.', offline: 'Offline', offlineReady: 'Offline ready', local: 'Local',
  scores: 'Scores', scoreMode: 'Mode', scoreTime: 'Time', scoreDate: 'Completed', scoreHint: 'Every cleared field records its mode and time on this device.', scoreEmpty: 'No completed fields yet.', scoreStorageError: 'Unable to save this score. It remains available for this session.',
  board: 'Minesweeper', navigation: 'Game menu', columns: 'columns', rows: 'rows', cell: 'Cell', covered: 'Covered', revealed: 'Revealed', flagged: 'Flagged', mine: 'Mine', empty: 'Empty', adjacent: 'Adjacent mines',
};
export const translations = { zh, en };
