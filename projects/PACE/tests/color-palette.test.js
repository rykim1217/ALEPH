import test from 'node:test';import assert from 'node:assert/strict';import {palette,shadesFor,familyFor,detailColors} from '../src/color-palette.js';
test('기본 팔레트는 8가지 색상 계열을 제공한다',()=>{assert.deepEqual(palette.map(([n])=>n),['보라','파랑','청록','초록','노랑','주황','로즈','차콜']);assert.equal(new Set(palette.map(([,c])=>c)).size,8);});
test('세부 팔레트는 밝은색부터 기본색과 어두운색을 제공한다',()=>{for(const [,base] of palette){const shades=shadesFor(base);assert.equal(shades.length,8);assert.ok(shades.includes(base));assert.equal(new Set(shades).size,8);for(const color of shades)assert.match(color,/^#[0-9A-F]{6}$/);const sum=c=>c.slice(1).match(/../g).reduce((s,n)=>s+parseInt(n,16),0);assert.ok(sum(shades[0])>sum(base));assert.ok(sum(shades[7])<sum(base));}});
test('저장된 세부색의 계열을 복원하고 기존 사용자 지정색도 분류한다',()=>{palette.forEach(([,base],index)=>{for(const color of shadesFor(base))assert.equal(familyFor(color),index);});for(const color of ['#123456','#FFFFFF','#000000'])assert.ok(familyFor(color)>=0&&familyFor(color)<8);});

test('사용자 지정 색상을 초기화하지 않고 세부 팔레트는 항상 8개를 표시한다',()=>{for(const [,base] of palette){for(const saved of ['#123456','#FFFFFF',base]){const choices=detailColors(base,saved);assert.equal(choices.length,8);assert.ok(choices.includes(saved));assert.equal(new Set(choices).size,8);}}});

test('주황 세부색은 크림색부터 귤색까지 8개이며 검게 탁해지지 않는다',()=>{const shades=shadesFor('#F39D31');assert.equal(shades.length,8);assert.equal(shades[0],'#FFF3DF');assert.equal(shades[7],'#D95F22');assert.ok(shades.includes('#F39D31'));});

test('모든 계열의 세부 8색은 기본색을 포함하고 밝기 순서가 유지된다',()=>{const brightness=c=>c.slice(1).match(/../g).reduce((sum,n)=>sum+parseInt(n,16),0);for(const [,base] of palette){const colors=shadesFor(base);assert.equal(colors.length,8);assert.ok(colors.includes(base));for(let i=1;i<colors.length;i++)assert.ok(brightness(colors[i])<brightness(colors[i-1]));}});
