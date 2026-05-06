<?xml version="1.0" encoding="GBK"?>
<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:vio="http://www.sunwiseinfo.com/xsd/violation">
	<!-- 根据文件名分组 -->
	<xsl:key name="runtimeFile" match="//vio:violations[@ruleset='运行时错误']/vio:item/vio:violation" use="@file" />
	<xsl:key name="patternFile" match="//vio:violations[@ruleset='型号软件典型故障模式']/vio:item/vio:violation" use="@file" />
	<xsl:key name="violationFile" match="//vio:violations[@ruleset!='型号软件典型故障模式' and @ruleset!='运行时错误']/vio:item/vio:violation" use="@file" />
	<!-- 整个文档 -->
	<xsl:template match="/">
		<html>
			<head>
				<META http-equiv="Content-Type" content="text/html; charset=GBK" />
				<title>SpecChecker静态分析概要报告</title>
				<link rel="stylesheet" type="text/css" href=".config/bootstrap.css" />
				<link rel="stylesheet" type="text/css" href=".config/speccheckerweb.css" />
			</head>
			<body>
				<h2 align="center">SpecChecker静态分析概要报告</h2>
				<div class="container-fluid">
					<div class="row-fluid">
						<div class="span10 offset1">
							<xsl:apply-templates />
						</div>
					</div>
				</div>
			</body>
		</html>
	</xsl:template>
	<!-- 度量 -->
	<xsl:template match="vio:metrics">
		<br></br>
		<div class="portlet box green">
			<div class="portlet-title">
				<div class="caption">
					<i class="icon-gift icon-white"></i>
					分析时间统计
				</div>
			</div>
			<div class="portlet-body">
				<div class="main" id="mainTotal">
					<table class="table table-bordered">
						<tbody>
							<tr class="success">
								<th width="10%">序号</th>
								<th width="60%">文件名</th>
								<th width="10%">时间(s)</th>
							</tr>
							<xsl:for-each select="vio:time">
								<xsl:sort select="@takes" order="descending" data-type="number" ></xsl:sort>
										<tr>
											<td>
												<xsl:value-of select="position()" />
											</td>
											<td>
												<xsl:value-of select="@name" />
											</td>
											<td>
												<xsl:value-of select="@takes div 1000" />
											</td>
										</tr>
							</xsl:for-each>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</xsl:template>
	<!-- 错误 -->
	<xsl:template match="vio:errors">
	</xsl:template>
	<!-- 违反 -->
	<xsl:template match="vio:violations[@ruleset='运行时错误']">
		<div class="portlet box red">
			<div class="portlet-title">
				<div class="caption">
					<i class="icon-gift icon-white"></i>
					运行时错误次数统计
				</div>
			</div>
			<div class="portlet-body">
				<div class="main" id="mainTotal">
					<table class="table table-bordered">
						<tbody>
							<tr class="success">
								<th>序号</th>
								<th>缺陷描述</th>
								<th>缺陷分类</th>
								<th>优先级</th>
								<th>缺陷发生次数</th>
							</tr>
							<xsl:for-each select="vio:item">
								<xsl:sort select="@description" order="ascending"
									data-type="text"></xsl:sort>
								<tr>
									<td>
										<xsl:value-of select="position()" />
									</td>
									<td>
										<xsl:value-of select="@description" />
									</td>
									<td>
										<xsl:value-of select="@category" />
									</td>
									<td>
										<xsl:choose>
											<xsl:when test="@priority &lt; 4">
												<xsl:choose>
													<xsl:when test="@priority &lt; 3">
														<font color="red">
															<xsl:value-of select="@priorityName" />
														</font>
													</xsl:when>
													<xsl:otherwise>
														<font color="Chocolate">
															<xsl:value-of select="@priorityName" />
														</font>
													</xsl:otherwise>
												</xsl:choose>
											</xsl:when>
											<xsl:otherwise>
												<font color="blue">
													<xsl:value-of select="@priorityName" />
												</font>
											</xsl:otherwise>
										</xsl:choose>
									</td>
									<td>
										<xsl:value-of select="count((child::*))" />
									</td>
								</tr>
							</xsl:for-each>
						</tbody>
					</table>
				</div>
			</div>
		</div>
		
		<div class="portlet box yellow">
			<div class="portlet-title">
				<div class="caption">
					<i class="icon-gift icon-white"></i>
					文件运行时错误发生次数统计
				</div>
			</div>
			<div class="portlet-body">
				<div class="main" id="mainTotal">
					<table class="table table-bordered">
						<tbody>
							<tr class="success">
								<th>序号</th>
								<th>文件</th>
								<th>缺陷发生次数</th>
							</tr>
							<xsl:for-each
								select="vio:item/vio:violation[count(.|key('runtimeFile',@file)[1])=1]">
								<xsl:sort select="count(key('runtimeFile',@file))"
									order="descending" data-type="number" />
								<tr>
									<td>
										<xsl:value-of select="position()" />
									</td>
									<td>
										<xsl:value-of select="@file" />
									</td>
									<td>
										<xsl:value-of select="count(key('runtimeFile',@file))" />
									</td>
								</tr>
							</xsl:for-each>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</xsl:template>
	
	<xsl:template match="vio:violations[@ruleset='型号软件典型故障模式']">
		<div class="portlet box purple">
			<div class="portlet-title">
				<div class="caption">
					<i class="icon-gift icon-white"></i>
					典型故障模式次数统计
				</div>
			</div>
			<div class="portlet-body">
				<div class="main" id="mainTotal">
					<table class="table table-bordered">
						<tbody>
							<tr class="success">
								<th>序号</th>
								<th>故障模式描述</th>
								<th>故障模式分类</th>
								<th>优先级</th>
								<th>故障发生次数</th>
							</tr>
							<xsl:for-each select="vio:item">
								<xsl:sort select="@description" order="ascending"
								data-type="text"></xsl:sort>
								<tr>
									<td>
										<xsl:value-of select="position()" />
									</td>
									<td>
										<xsl:value-of select="@description" />
									</td>
									<td>
										<xsl:value-of select="@category" />
									</td>
									<td>
										<xsl:choose>
											<xsl:when test="@priority &lt; 4">
												<xsl:choose>
													<xsl:when test="@priority &lt; 3">
														<font color="red">
															<xsl:value-of select="@priorityName" />
														</font>
													</xsl:when>
													<xsl:otherwise>
														<font color="Chocolate">
															<xsl:value-of select="@priorityName" />
														</font>
													</xsl:otherwise>
												</xsl:choose>
											</xsl:when>
											<xsl:otherwise>
												<font color="blue">
													<xsl:value-of select="@priorityName" />
												</font>
											</xsl:otherwise>
										</xsl:choose>
									</td>
									<td>
										<xsl:value-of select="count((child::*))" />
									</td>
								</tr>
							</xsl:for-each>
						</tbody>
					</table>
				</div>
			</div>
		</div>
		
		<div class="portlet box yellow">
			<div class="portlet-title">
				<div class="caption">
					<i class="icon-gift icon-white"></i>
					文件典型故障模式发生次数统计
				</div>
			</div>
			<div class="portlet-body">
				<div class="main" id="mainTotal">
					<table class="table table-bordered">
						<tbody>
							<tr class="success">
								<th>序号</th>
								<th>文件</th>
								<th>故障发生次数</th>
							</tr>
							<xsl:for-each
								select="vio:item/vio:violation[count(.|key('patternFile',@file)[1])=1]">
								<xsl:sort select="count(key('patternFile',@file))"
									order="descending" data-type="number" />
								<tr>
									<td>
										<xsl:value-of select="position()" />
									</td>
									<td>
										<xsl:value-of select="@file" />
									</td>
									<td>
										<xsl:value-of select="count(key('patternFile',@file))" />
									</td>
								</tr>
							</xsl:for-each>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</xsl:template>
	
	<xsl:template match="vio:violations[@ruleset!='型号软件典型故障模式' and @ruleset!='运行时错误']">
		<div class="portlet box blue">
			<div class="portlet-title">
				<div class="caption">
					<i class="icon-gift icon-white"></i>
					规则违反次数统计
				</div>
			</div>
			<div class="portlet-body">
				<div class="main" id="mainTotal">
					<table class="table table-bordered">
						<tbody>
							<tr class="success">
								<th>序号</th>
								<th>规则描述</th>
								<th>规则分类</th>
								<th>优先级</th>
								<th>违反次数</th>
							</tr>
							<xsl:for-each select="vio:item">
								<xsl:sort select="@description" order="ascending"
									data-type="text"></xsl:sort>
								<tr>
									<td>
										<xsl:value-of select="position()" />
									</td>
									<td>
										<xsl:value-of select="@description" />
									</td>
									<td>
										<xsl:value-of select="@category" />
									</td>
									<td>
										<xsl:choose>
											<xsl:when test="@priority &lt; 4">
												<xsl:choose>
													<xsl:when test="@priority &lt; 3">
														<font color="red">
															<xsl:value-of select="@priorityName" />
														</font>
													</xsl:when>
													<xsl:otherwise>
														<font color="Chocolate">
															<xsl:value-of select="@priorityName" />
														</font>
													</xsl:otherwise>
												</xsl:choose>
											</xsl:when>
											<xsl:otherwise>
												<font color="blue">
													<xsl:value-of select="@priorityName" />
												</font>
											</xsl:otherwise>
										</xsl:choose>
									</td>
									<td>
										<xsl:value-of select="count((child::*))" />
									</td>
								</tr>
							</xsl:for-each>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<div class="portlet box yellow">
			<div class="portlet-title">
				<div class="caption">
					<i class="icon-gift icon-white"></i>
					规则违反文件违反次数统计
				</div>
			</div>
			<div class="portlet-body">
				<div class="main" id="mainTotal">
					<table class="table table-bordered">
						<tbody>
							<tr class="success">
								<th>序号</th>
								<th>文件</th>
								<th>违反次数</th>
							</tr>
							<xsl:for-each
								select="vio:item/vio:violation[count(.|key('violationFile',@file)[1])=1]">
								<xsl:sort select="count(key('violationFile',@file))"
									order="descending" data-type="number" />
								<tr>
									<td>
										<xsl:value-of select="position()" />
									</td>
									<td>
										<xsl:value-of select="@file" />
									</td>
									<td>
										<xsl:value-of select="count(key('violationFile',@file))" />
									</td>
								</tr>
							</xsl:for-each>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</xsl:template>
</xsl:stylesheet>	<div class="portlet-title">
				<div class="caption">
					<i cla