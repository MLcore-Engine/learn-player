 # React Props 与回调函数使用指南

## 1. 概念介绍

在 React 中，组件之间通过 **props**（属性） 进行通信。父组件可以把数据和回调函数作为 props 传递给子组件，子组件调用回调函数通知父组件触发状态更新或执行某些逻辑。

- **Props**：只读的属性，父组件传给子组件，用于定制渲染或传递数据。
- **回调函数（Callback）**：父组件把一个函数传给子组件，子组件内部通过调用该函数来“向上传递”事件或数据。

这种模式避免了直接操作父组件状态，提高了组件的复用性和可维护性。

---

## 2. 为什么要使用 Props 与回调函数

1. **单向数据流**：React 遵循单向数据流，数据从父向子流动。子组件不能直接修改父组件状态，只能通过回调请求父组件修改。
2. **解耦组件**：子组件只关心自己的表现形式，不关心父组件状态，只需调用传入的函数即可。
3. **增强复用**：同一个子组件在不同场景下可以接收不同 props 与回调，实现不同功能。

---

## 3. 简单示例

假设我们有一个计数器组件 `Counter`，希望在子组件中点击按钮时，通知父组件更新计数：

```jsx
// Parent.js
import React, { useState } from 'react';
import Counter from './Counter';

function Parent() {
  const [count, setCount] = useState(0);

  // 回调函数：增加计数
  const handleIncrease = () => {
    setCount(prev => prev + 1);
  };

  return (
    <div>
      <h1>当前计数：{count}</h1>
      {/* 将 count 作为 props 传给子组件 */}
      {/* 将回调函数 handleIncrease 也传给子组件 */}
      <Counter
        value={count}
        onIncrease={handleIncrease}
      />
    </div>
  );
}

export default Parent;
```

```jsx
// Counter.js
import React from 'react';

function Counter({ value, onIncrease }) {
  return (
    <div>
      <p>子组件收到的计数：{value}</p>
      {/* 点击时调用父组件传入的回调 */}
      <button onClick={onIncrease}>增加</button>
    </div>
  );
}

export default Counter;
```

运行结果：
1. 点击 `Counter` 里的按钮时，调用 `onIncrease`。
2. `Parent` 的 `handleIncrease` 执行，更新状态 `count`。
3. `Parent` 和 `Counter` 都会根据新的 props 重渲染。

---

## 4. 结合当前项目应用场景

在视频播放器项目里：
- `App.js` 作为父组件，管理选择视频、加载字幕等逻辑。
- `VideoPlayer.js` 作为子组件，只负责渲染播放器和接收用户操作事件。

示例代码片段：
```jsx
<VideoPlayer
  videoPath={videoData.path}
  subtitles={subtitles}
  onTimeUpdate={handleTimeUpdate}
  onSubtitleSelect={handleSubtitleSelect}
  onOCR={handlePerformOCR}
  hasExternalSubtitles={hasExternalSubtitles}
  initialTime={timeStats.currentPosition}
  onSelectSubtitleFile={handleSelectSubtitleFile}
/>
```
- **`onTimeUpdate`**：子组件播放进度变化时调用，父组件更新 UI 或统计数据。
- **`onOCR`**：子组件点击 OCR 按钮时调用，父组件打开 OCR 逻辑。
- **`onSelectSubtitleFile`**：子组件点击“选择字幕”时调用，父组件弹出文件对话框并加载字幕。

---

## 5. 注意事项与最佳实践

1. **Prop 校验**：使用 `PropTypes` 或 TypeScript 定义组件接口。
2. **函数记忆**：当回调函数传给子组件时，若父组件频繁重渲染可用 `useCallback` 避免不必要子组件更新。
3. **解构 props**：在子组件开头解构所有 props，提高可读性。
4. **命名约定**：回调函数 props 常用 `onXxx` 或 `handleXxx` 前缀。

---

## 6. 总结

- React 的 props 和回调函数模式，遵循单向数据流，实现父子组件解耦。
- 父组件通过 props 下发数据和回调，子组件通过调用回调将事件或新数据“上报”给父组件。
- 在复杂项目中，这种模式保证组件职责单一、易于维护和复用。

欢迎把此文档保存到项目的 `docs` 目录，并根据需要扩展或翻译成其他语言。祝您学习愉快！
