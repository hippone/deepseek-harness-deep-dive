---
layout: home
title: 概览
---

<section class="home-hero">
  <img class="hero-whale" src="{{ '/assets/deepseek-logo.svg' | relative_url }}" alt="DeepSeek 官方鲸鱼标志">
  <p class="hero-kicker">SOURCE-LEVEL ARCHITECTURE NOTES</p>
  <h1>DeepSeek Harness<br><span>源码解构手册</span></h1>
  <p class="hero-lede">从 Cordis 生命周期、产品配置树一路追到 Agent Loop、会话事实和工具治理。面向需要评估、建设或接手 Agent 运行时的工程团队。</p>
  <div class="hero-actions">
    <a class="hero-button hero-button-primary" href="{{ '/deep-dive/' | relative_url }}">开始阅读 →</a>
    <a class="hero-button" href="{{ '/executive-brief/' | relative_url }}">先看决策摘要</a>
    <a class="hero-button" href="{{ '/appendices/sources-and-evidence/' | relative_url }}">核对源码证据</a>
  </div>
  <div class="baseline-strip">
    <span>研究基线</span>
    <strong>deepseek-ai/deepseek-harness</strong>
    <code>47f943859bef</code>
  </div>
</section>

<p class="section-label">贯穿全文的观察路径</p>

<section class="architecture-rail">
  <div><b>Cordis</b><span>OWNERSHIP</span></div>
  <div><b>Product Tree</b><span>ASSEMBLY</span></div>
  <div><b>Agent Runtime</b><span>EXECUTION</span></div>
  <div><b>Evidence</b><span>ADOPTION</span></div>
</section>

本文是独立技术解析，不代表 DeepSeek 官方观点。站内鲸鱼图形取自固定提交中的 DeepSeek Harness 官方品牌资产。
