# 导航与厕所展示检查 · 2026-09-29

## 已处理

- 81 个地点统一使用明确的地点名、城市和地址；不再用示意坐标生成外部导航。地点详情、酒店、餐饮、每日分段、地图嵌入和复制地址共用这一来源。
- D2：SkyBus 客运站、Dorsett 615 Little Lonsdale、Higher Ground 650 Little Bourke、lululemon Emporium。补齐合并项目内的 Royal Arcade 和 St Paul's；Swisse 仍是独立可选项。
- D3：Belgrave 的 Puffing Billy 与 Lakeside 午餐分开。Lakeside 定位只供跟团实际停靠时使用，不把铁路行程画成公路。
- D4：企鹅游客入口、十二门徒游客服务区、Loch Ard 停车区使用明确名称；Apollo Bay 热食继续指向 18 Pascoe，不回到施工中的旧港口店。团游停靠顺序仍由导游安排。
- D8：默认路线不再包含可选鱼市场、桥塔和天文台；三者保留独立可选导航。Fruitezy 保持新市场 1 Bridge Road / C2。
- D9：沿海途经 Tamarama、Bronte、Clovelly；Google 仍只是参考，现场海岸步道和封闭绕行标识优先。打车目标为 Taronga Main Entrance；渡轮查询从 Taronga Zoo Wharf 发起。
- 航班卡片默认对应出发机场；另有到达机场详情，不再误把未起飞的行程导向目的地机场。
- 多站路线最多 3 个中途站、URL 小于 2048 字符；不允许切成会丢失途经点的公共交通查询。海上地点仅定位，不生成道路路线。
- 厕所只对有来源的现场设施显示 11px 行内标记；未核实、住客私有及只有附近设施的地点不显示；每天如厕安排保留。

## 官方核对依据（重点易错地点）

- https://www.skybus.com.au/southern-cross-station/
- https://www.dorsetthotels.com/dorsett-melbourne/contact-us.html
- https://highergroundmelbourne.com.au/contact/
- https://www.emporiummelbourne.com.au/stores/lululemon-athletica
- https://spenceroutletcentre.com.au/stores/chemist-warehouse/
- https://puffingbilly.com.au/wp-content/uploads/Lakeside-Visitor-Centre-Facilities-Map-2022.pdf
- https://www.penguins.org.au/attractions/penguin-parade
- https://visitgreatoceanroad.org.au/visit12apostles/loch-ard-gorge/
- https://www.apollobayfishcoop.com.au/
- https://www.asado.melbourne/contact
- https://www.stalactites.com.au/
- https://harbourcove.com.au/contact/
- https://oceanrafting.com.au/contact-us/
- https://thedeckairliebeach.com.au/contact/
- https://coralsearesort.com/coralseapavilion/
- https://www.whitsundaycoastairport.com.au/Home/HTML-Welcome-to-Whitsunday-Coast-Airport
- https://www.gracehotel.com.au/location
- https://www.sydneyoperahouse.com/visit/our-venues/welcome-centre
- https://www.sydneyfishmarket.com.au/retailer/fruitezy/
- https://www.sydneyfishmarket.com.au/wp-content/uploads/2026/02/Sydney-Fish-Market-Site-Map.pdf
- https://www.sydney.com/things-to-do/nature-and-parks/walks/bondi-to-coogee-coastal-walk
- https://cdn.taronga.org.au/sydney-zoo/plan/visitor-information/getting-here
- https://www.sydneyairport.com.au/info-sheet/maps
- https://developers.google.com/maps/documentation/urls/get-started

## 验证范围与限制

- 自动化逐一打开所有地点导航弹层和所有每日分段，检查 URL 中的名称、地址、起终点、途经点顺序、模式、复制文本和嵌入地图的一致性；另覆盖餐饮、酒店入口。
- Google Maps 实际解析抽测：D2 的 SkyBus → Dorsett → Higher Ground → lululemon；D9 的 Coogee → Taronga。浏览器返回的正式路线名称与地址匹配，D2 原来的邻店错配消失。
- 并未声称在 Google 客户端中逐个实测全部 81 个地点，也未实地验证入口、步道、室内楼层或临时封闭。室内店铺、跟团接驳和海岸路线仍需依靠现场导视 / 运营商。
- 集合点 601 Lonsdale、300 Spencer 来自用户已确认订单，不替换成推测酒店入口。
- 回归命令（无第三方依赖）：`node --test tests/navigation-review.test.mjs`。
- 更完整的 DOM 集成检查位于工作区 `verify-navigation-review.cjs` 与 `verify-trip-toilets.cjs`。
