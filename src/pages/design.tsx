import { HeadFC, PageProps, navigate } from "gatsby";
import React from "react";
import { Objective, backend, languages, render, getLanguageId, PureUnit, parseQuery } from "../frontend/api";
import { AlertDialog, AlertDialogBody, AlertDialogCloseButton, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Box, Button, FormControl, FormHelperText, FormLabel, Grid, GridItem, HStack, IconButton, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverHeader, PopoverTrigger, Select, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Stack, Switch, Tab, TabList, TabPanel, TabPanels, Tabs, Tag, TagCloseButton, TagLabel, TagRightIcon, Text, Textarea, useDisclosure, useToast } from "@chakra-ui/react";
import { Navbar } from "../components/Navbar";
import { IconArrowBarToLeft, IconArrowBarToRight, IconArrowLeft, IconArrowRight, IconCheck, IconCornerUpLeft, IconCornerUpRight, IconExclamationCircle, IconHelp, IconMarkdown, IconPlus, IconSettings, IconTrash, IconTrashX } from "@tabler/icons-react";
import DOMPurify from "dompurify";
import { langs, loadLanguage } from "@uiw/codemirror-extensions-langs";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import CodeMirror from '@uiw/react-codemirror';
import { height, width } from '../frontend/const';

const INVALID_DATE = new Date(NaN);

function formatDate(date: Date): string {
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function checkObjective(objective: Objective): string | null {
  if (!objective.name.length) {
    return "请指定问题名。"
  }
  if (!objective.description.length) {
    return "请指定问题描述。"
  }
  if (objective.mode & 0b100) {
    if (!objective.pointCount) {
      return "请指定数据点数量。"
    }
    if (!objective.rScript.length) {
      return "请指定 RandomJudge 脚本。";
    }
  }
  else if (objective.mode & 0b010) {
    if (!objective.sScript.length) {
      return "请指定 SpecialJudge 脚本。";
    }
  }
  else {
    if (!objective.points?.length) {
      return "请上传数据点。"
    }
  }
  return null;
}

const DesignPage: React.FC<PageProps> = props => {
  const [id, setId] = React.useState<string>();
  const [unit, setUnit] = React.useState<PureUnit<Objective>>({
    name: '',
    time: INVALID_DATE, // Invalid Date
    deadline: INVALID_DATE,
    groups: null,
    tags: [],
    objectives: [],
  });
  const [groups, setGroups] = React.useState<Record<string, number>>({});
  const [addingTag, setAddingTag] = React.useState(false);
  const [addingGroup, setAddingGroup] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [renderedDescription, setRenderedDescription] = React.useState('');
  const descriptionUpdateRef = React.useRef<any>();
  const deleter = useDisclosure();
  const remover = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const cancelWholeRef = React.useRef<HTMLButtonElement>(null);
  const toast = useToast({ position: 'top', duration: 4000 });

  const objective = unit.objectives[active];
  const lines = active >= 0 ? objective.template.map(r => r.content.split('\n').length).reduce((a, b) => a+b) : 0;

  React.useEffect(() => {
    const query = parseQuery(props.location.search);
    if (query.id) {
      backend.fetchFullUnit(query.id).then(unit => {
        setId(unit.id);
        setUnit({
          name: unit.name,
          time: unit.time,
          deadline: unit.deadline,
          groups: unit.groups,
          tags: unit.tags,
          objectives: unit.objectives
        });
      })
    }
    backend.fetchGroups().then(setGroups);
  }, []);

  React.useEffect(() => {
    if (active >= 0) {
      setRenderedDescription(DOMPurify.sanitize(render(objective.description)));
    }
  }, [active]);
  return <>
    <Navbar/>
    <Grid templateColumns='repeat(4, 1fr)' h='calc(100vh - 75px - .5rem)'>
      <GridItem colSpan={1} h='100%' borderRightColor='#ffffff17' borderRightWidth={1} >
        <Stack p={3} h='100%'>
          <FormControl>
            <FormLabel fontWeight='bold'>单元名称</FormLabel>
            <Input placeholder='Unit::name' _placeholder={{ fontFamily: 'var(--mono-font)'}} onChange={e => {
              unit.name = e.target.value;
              setUnit({...unit});
            }} value={unit.name}/>
          </FormControl>
          <FormControl>
            <FormLabel fontWeight='bold'>开始时间</FormLabel>
            <Input type='datetime-local' onChange={e => {
              const date = new Date(e.target.value);
              if (date > unit.deadline) {
                unit.deadline = unit.time;
              }
              unit.time = date;
              setUnit({...unit});
            }} value={formatDate(unit.time)}/>
            <FormHelperText>
              开始时间只作为信息提示用户，开始时间前可以作答。
            </FormHelperText>
          </FormControl>
          <FormControl>
            <FormLabel fontWeight='bold'>截止时间</FormLabel>
            <Input type='datetime-local' onChange={e => {
              const date = new Date(e.target.value);
              if (date <= unit.time) {
                unit.deadline = unit.time;
              }
              else {
                unit.deadline = date;
              }
              setUnit({...unit});
            }} value={formatDate(unit.deadline)}/>
          </FormControl>
          <Text fontWeight='bold' textTransform='uppercase'>Groups</Text>
          <HStack flexWrap='wrap'>
            {
              unit.groups?.map(group => 
                <Tag colorScheme='green' variant='solid' key={group}>
                  <TagLabel>{group} ({groups[group]})</TagLabel>
                  <TagCloseButton onClick={() => {
                    unit.groups!.splice(unit.tags.indexOf(group), 1);
                    if (unit.groups!.length <= 0) {
                      unit.groups = null;
                    }
                    setUnit({...unit});
                  }}/>
                </Tag>
              )
            }
            {
              addingGroup ? 
              <Input size='sm' onKeyDown={e => {
                if (e.key === "Escape") {
                  setAddingGroup(false);
                }
                if (e.key === "Enter" 
                  && (e.currentTarget.value.trim() in groups)
                  && (!unit.groups || !unit.groups.includes(e.currentTarget.value.trim()))) {
                  (
                    unit.groups || (unit.groups = [])
                  ).push(e.currentTarget.value.trim());
                  setAddingGroup(false);
                }
              }} placeholder='Group'/>
              :
              <Tag cursor='pointer' colorScheme="green" variant='outline' onClick={() => {
                setAddingGroup(true);
              }}>
                <TagLabel>
                  添加
                </TagLabel>
                <TagRightIcon as={IconPlus}/>
              </Tag>
            }
          </HStack>
          <Text fontSize={12} color='whiteAlpha.600'>
            注：不指定 Group 时将允许任意用户访问。
          </Text>
          <Text fontWeight='bold' textTransform='uppercase'>Tags</Text>
          <HStack flexWrap='wrap'>
            {
              unit.tags.map(tag => 
                <Tag colorScheme='green' variant='solid' key={tag}>
                  <TagLabel>{tag}</TagLabel>
                  <TagCloseButton onClick={() => {
                    unit.tags.splice(unit.tags.indexOf(tag), 1);
                    setUnit({...unit});
                  }}/>
                </Tag>
              )
            }
            {
              addingTag ? 
              <Input size='sm' onKeyDown={e => {
                if (e.key === "Escape") {
                  setAddingTag(false);
                }
                if (e.key === "Enter" && !unit.tags.includes(e.currentTarget.value.trim())) {
                  unit.tags.push(e.currentTarget.value.trim());
                  setAddingTag(false);
                }
              }} placeholder='Tag'/>
              :
              <Tag cursor='pointer' colorScheme="green" variant='outline' onClick={() => {
                setAddingTag(true);
              }}>
                <TagLabel>
                  添加
                </TagLabel>
                <TagRightIcon as={IconPlus}/>
              </Tag>

            }
          </HStack>
          <Box flexGrow={1}/>
          <HStack>
            <Stack>
              <IconButton aria-label="delete" size='sm' title='删除' isDisabled={active<0} onClick={deleter.onOpen}>
                <IconTrashX/>
              </IconButton>
              <IconButton aria-label="first objective" size='sm' title='第一题' isDisabled={!unit.objectives.length} onClick={() => setActive(0)}>
                <IconArrowBarToLeft/>
              </IconButton>
            </Stack>
            <Stack>
              <IconButton aria-label="move backwards" size='sm' title='前移' isDisabled={active <= 0} onClick={() => {
                const objectives = [
                  ...unit.objectives.slice(0, active-1),
                  unit.objectives[active],
                  unit.objectives[active-1],
                  ...unit.objectives.slice(active+1)
                ];
                setUnit({...unit, objectives});
                setActive(active-1);
              }}>
                <IconCornerUpLeft/>
              </IconButton>
              <IconButton aria-label="previous objective" size='sm' title='上一题' isDisabled={active <= -1} onClick={() => {
                active > -1 && setActive(active-1);
              }}>
                <IconArrowLeft/>
              </IconButton>
            </Stack>
            <Stack flexGrow={1} h='100%' bg='whiteAlpha.300' rounded={5} justify='center' gap={0}>
              <Text textAlign='center' fontWeight="bold" userSelect='none'>
                {
                  active < 0 ? "点击 \"+\" 添加题目" : objective.name || "[未命名]"
                }
              </Text>
              <Text textAlign='center' fontFamily='var(--mono-font)' fontSize={12}>
                #{active+1} / {unit.objectives.length}
              </Text>
            </Stack>
            <Stack>
              <IconButton aria-label="move forwards" size='sm' title='后移' isDisabled={active < 0 || active >= unit.objectives.length-1} onClick={() => {
                const objectives = [
                  ...unit.objectives.slice(0, active),
                  unit.objectives[active+1],
                  unit.objectives[active],
                  ...unit.objectives.slice(active+2)
                ];
                setUnit({...unit, objectives});
                setActive(active+1);
              }}>
                <IconCornerUpRight/>
              </IconButton>
              <IconButton aria-label="next objective" size='sm' title='下一题' isDisabled={active >= unit.objectives.length-1} onClick={() => {
                active < unit.objectives.length-1 && setActive(active+1);
              }}>
                <IconArrowRight/>
              </IconButton>
            </Stack>
            <Stack>
              <IconButton aria-label="insert" size='sm' title='插入新题目' onClick={() => {
                unit.objectives.splice(active+1, 0, {
                  name: '未命名',
                  description: "",
                  difficulty: 1,
                  template: [{
                    content: "",
                    editable: true,
                    indent: 0,
                  }],
                  mode: 0,
                  language: 0, // C
                  pointCount: 0,
                  points: [],
                  rScript: "",
                  sScript: "",
                });
                setUnit({...unit});
                setActive(active+1);
              }}>
                <IconPlus/>
              </IconButton>
              <IconButton aria-label="last objective" size='sm' title='最后一题' isDisabled={!unit.objectives.length} onClick={() => setActive(unit.objectives.length-1)}>
                <IconArrowBarToRight/>
              </IconButton>
            </Stack>
          </HStack>
          <HStack>
            <Button colorScheme='green' leftIcon={<IconCheck size={16}/>} flexGrow={1} isDisabled={!unit.objectives.length} onClick={() => {
              for (let i = 0; i < unit.objectives.length; i++) {
                const msg = checkObjective(unit.objectives[i]);
                if (msg) {
                  toast({
                    title: `#${i+1} ${unit.objectives[i].name}`,
                    description: msg,
                    status: 'error'
                  })
                  return;
                }
                if (id) {
                  backend.updateUnit(id, unit).then(() => navigate("/unit?id=" + id));
                }
                else {
                  backend.createUnit(unit).then(() => navigate("/"));
                }
              }
            }}>提交</Button>
            { id ? 
            <Button colorScheme='red' leftIcon={<IconTrash size={16}/>} flexGrow={1} onClick={remover.onOpen}>
              删除
            </Button>
            : undefined }
          </HStack>
        </Stack>
      </GridItem>
      <GridItem colSpan={3} h='calc(100vh - 75px - .5rem)'>
        {
          active < 0 ? 
          <Stack h='100%' justify='center'>
            <Text textAlign='center' color='whiteAlpha.600'>未选中任何题目。</Text>
          </Stack>
          :
          <Box p={3} h='calc(100vh - 75px - .5rem)'>
            <Tabs variant='solid-rounded' h='100%' colorScheme='green' isLazy>
              <TabList>
                <Tab>基础</Tab>
                <Tab>模板 & 数据点</Tab>
                <Tab>
                  MagicJudge🪄
                  <sup>
                    <a href='https://github.com/origamizyt/zdotoj/blob/main/README.md'>
                      <IconHelp size={12}/>
                    </a>
                  </sup>
                </Tab>
              </TabList>
              <TabPanels h='calc(100% - 40px)'>
                <TabPanel h='100%'>
                  <Grid templateColumns='repeat(2, 1fr)' gap={2} h='100%'>
                    <GridItem colSpan={1}>
                      <Stack h='100%'>
                        <Text fontWeight='bold' fontSize={14}>题目名称</Text>
                        <Input placeholder='Objective::name' _placeholder={{ fontFamily: 'var(--mono-font)'}} size='sm' onChange={e => {
                          objective.name = e.target.value;
                          setUnit({...unit});
                        }} value={objective.name}/>
                        <Text fontWeight='bold' fontSize={14}>题目难度</Text>
                        <HStack gap={4}>
                          <Box flexGrow={1}>
                            <Slider max={10} min={1} value={objective.difficulty} onChange={val => {
                              objective.difficulty = val;
                              setUnit({...unit});
                            }} colorScheme="green">
                              <SliderTrack>
                                <SliderFilledTrack/>
                              </SliderTrack>
                              <SliderThumb/>
                            </Slider>
                          </Box>
                          <Text color={`red.${Math.floor(objective.difficulty/2)*100+100}`} fontWeight='bold'>{objective.difficulty}</Text>
                        </HStack>
                        <Text fontWeight='bold' fontSize={14}>语言</Text>
                        <Select size='sm' onChange={e => {
                          objective.language = parseInt(e.target.value);
                          setUnit({...unit});
                        }} value={objective.language}>
                          {
                            languages.map((lang, index) => <option key={lang.id} value={index}>{lang.name}</option>)
                          }
                        </Select>
                        <HStack gap={1}>
                          <Text as='span' fontWeight='bold' fontSize={14}>
                            描述
                          </Text>
                          <IconMarkdown size={16}/>
                          <Box flexGrow={1}/>
                          <Text as='span' fontSize={14}>
                            Live Preview &gt;
                          </Text>
                        </HStack>
                        <Textarea flexGrow={1} resize='none' size='sm' fontFamily='var(--mono-font)' placeholder='Objective::description (Markdown)' onChange={e => {
                          objective.description = e.target.value;
                          setUnit({...unit});
                          if (descriptionUpdateRef.current) {
                            clearTimeout(descriptionUpdateRef.current);
                          }
                          descriptionUpdateRef.current = setTimeout(() => {
                            setRenderedDescription(DOMPurify.sanitize(render(objective.description)));
                          }, 1000);
                        }} spellCheck={false} value={objective.description}/>
                      </Stack>
                    </GridItem>
                    <GridItem colSpan={1}>
                      <Box h='calc(100vh - 75px - .5rem - 30px - 40px)' overflowY='auto' p={3} borderWidth={1} borderColor='#ffffff17' rounded={3}>
                        <div className='md' dangerouslySetInnerHTML={{ __html: renderedDescription }} />
                      </Box>
                    </GridItem>
                  </Grid>
                </TabPanel>
                <TabPanel h='calc(100vh - 75px - .5rem - 15px - 40px)' overflowY='auto'>
                  <Grid templateColumns='repeat(2, 1fr)' gap={2}>
                    <GridItem colSpan={1}>
                      <Button size='sm' colorScheme="green" onClick={() => {
                        objective.template.push({
                          content: '',
                          editable: true,
                          indent: 0,
                        })
                        setUnit({...unit});
                      }}>添加 Region</Button>
                      <HStack gap={0} mt={2} bg='#1e1e1e'>
                        <Box px={2} justifySelf='flex-start' mt='1.5px'>
                          { 
                            new Array(lines).fill(0).map((_, index) => 
                              <Text fontFamily='var(--mono-font)' fontSize={14} h={height} key={index}>{index+1}</Text>
                            )
                          }
                        </Box>
                        <Box flexGrow={1}>
                          {
                            objective.template.map((region, index) => {
                              return <HStack gap={0} key={index} borderTopColor='#ffffff17' borderTopWidth={index > 0 ? 1 : 0}>
                                <Box w={`${region.indent*width}px`}></Box>
                                <CodeMirror
                                  style={{ flexGrow: 1 }}
                                  theme={vscodeDark} 
                                  value={region.content}
                                  extensions={[ loadLanguage(getLanguageId(objective.language) as keyof typeof langs)! ]} 
                                  basicSetup={{ lineNumbers: false, tabSize: 4 }}
                                  onChange={value => {
                                    region.content = value;
                                    setUnit({...unit});
                                  }}/>
                                <Box ml={2}>
                                  <Popover placement='right'>
                                    <PopoverTrigger>
                                      <IconSettings size={13}/>
                                    </PopoverTrigger>
                                    <PopoverContent>
                                      <PopoverArrow/>
                                      <PopoverHeader fontWeight='bold'>设置 Region 属性</PopoverHeader>
                                      <PopoverBody>
                                        <Stack>
                                          <HStack>
                                            <Text fontSize={14}>可编辑</Text>
                                            <Switch isChecked={region.editable} onChange={e => {
                                              region.editable = e.target.checked;
                                              setUnit({...unit});
                                            }}/>
                                          </HStack>
                                          <HStack>
                                            <Text fontSize={14}>缩进</Text>
                                            <NumberInput value={region.indent} size='sm' onChange={n => {
                                              region.indent = parseInt(n);
                                              setUnit({...unit});
                                            }} min={0}>
                                              <NumberInputField/>
                                              <NumberInputStepper>
                                                <NumberIncrementStepper/>
                                                <NumberDecrementStepper/>
                                              </NumberInputStepper>
                                            </NumberInput>
                                          </HStack>
                                          <Button colorScheme='red' size='sm' isDisabled={objective.template.length <= 1} onClick={() => {
                                            objective.template.splice(index, 1);
                                            setUnit({...unit});
                                          }}>删除</Button>
                                        </Stack>
                                      </PopoverBody>
                                    </PopoverContent>
                                  </Popover>
                                </Box>
                              </HStack>
                            })
                          }
                        </Box>
                      </HStack>
                    </GridItem>
                    <GridItem colSpan={1}>
                      <Button size='sm' colorScheme='green' onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'application/json';
                        input.addEventListener('change', async () => {
                          if (!input.files) return;
                          const text = await input.files[0].text();
                          objective.points = JSON.parse(text);
                          setUnit({...unit});
                        });
                        input.click();
                      }} isDisabled={objective.points === null}>上传数据点</Button>
                      { objective.points === null ? 
                      <Text mt={2} color='whiteAlpha.600'>
                        此题目启用了 RandomJudge。
                      </Text> : undefined}
                      { objective.points && objective.points.length ? undefined:
                      <Text fontSize={14} mt={2} fontFamily='var(--mono-font)'>
                        数据点文件为一个 JSON 数组，每个元素包含以下项：<br/>
                        - in: string, 输入内容<br/>
                        - out: string, 输出内容<br/>
                        - timeLimit: number, 时间限制(秒)，0为不限。<br/>
                        - memoryLimit: number, 内存限制(B)，0为不限。<br/>
                      </Text>
                      }
                      <Stack mt={2} gap={0}>
                        { objective.points?.map((point, index) =>
                        <HStack key={index} py={2} px={5} 
                          borderTopLeftRadius={index == 0 ? 5 : 0} borderTopRightRadius={index == 0 ? 5 : 0} 
                          borderTopWidth={index == 0 ? 1 : 0}
                          borderLeftWidth={1}
                          borderRightWidth={1}
                          borderBottomWidth={1}
                          borderBottomLeftRadius={index == objective.points!.length-1 ? 5 : 0} borderBottomRightRadius={index == objective.points!.length-1 ? 5 : 0} 
                          borderColor='#ffffff17'>
                          <Text fontSize={14} fontFamily='var(--mono-font)'>#{index+1}</Text>
                          <Box flexGrow={1}/>
                          <Text fontSize={14} fontFamily='var(--mono-font)' color='blue.500'>IN: {point.in.length} bytes</Text>
                          <Text fontSize={14} fontFamily='var(--mono-font)' color='green.500'>OUT: {point.out.length} bytes</Text>
                          <Text fontSize={14} fontFamily='var(--mono-font)' color='yellow.500'>{point.timeLimit}s, {point.memoryLimit}B</Text>
                        </HStack>
                        )}
                      </Stack>
                    </GridItem>
                  </Grid>
                </TabPanel>
                <TabPanel h='calc(100vh - 75px - .5rem - 15px - 40px)' overflowY='auto'>
                  <HStack>
                    <Text fontSize={14}>
                      启用 Strict
                    </Text>
                    <Switch isChecked={(objective.mode & 0b001) !== 0} onChange={() => {
                      objective.mode ^= 0b001;
                      if (objective.mode & 0b010) {
                        objective.mode ^= 0b010;
                      }
                      setUnit({...unit});
                    }}></Switch>
                  </HStack>
                  <Text mt={2} fontSize={14} color='whiteAlpha.600'>
                    Strict 将以最严格的方式进行评判（前置与后置空行、行前与行尾空格均视为错误答案）。
                  </Text>
                  <Grid templateColumns='repeat(2, 1fr)' gap={2} mt={2}>
                    <GridItem colSpan={1}>
                      <HStack>
                        <Text fontSize={14}>
                          启用 RandomJudge
                        </Text>
                        <Switch isChecked={(objective.mode & 0b100) !== 0} onChange={() => {
                          objective.mode ^= 0b100;
                          if (objective.mode & 0b100) {
                            objective.points = null;
                          }
                          else {
                            objective.points = [];
                            objective.rScript = "";
                          }
                          setUnit({...unit});
                        }}></Switch>
                      </HStack>
                      { objective.mode & 0b100 ?
                      <Box mt={2}>
                        <Text fontWeight='bold' fontSize={14}>数据点数量</Text>
                        <NumberInput value={objective.pointCount} size='sm' onChange={n => {
                          objective.pointCount = parseInt(n);
                          setUnit({...unit});
                        }} min={0} mb={2}>
                          <NumberInputField/>
                          <NumberInputStepper>
                            <NumberIncrementStepper/>
                            <NumberDecrementStepper/>
                          </NumberInputStepper>
                        </NumberInput>
                        <CodeMirror
                          style={{ flexGrow: 1 }}
                          theme={vscodeDark}
                          extensions={[ langs.lua() ]} 
                          basicSetup={{ lineNumbers: true, tabSize: 4 }}
                          value={objective.rScript}
                          onChange={val => {
                            objective.rScript = val;
                            setUnit({...unit});
                          }}
                          />
                      </Box>
                      : 
                      <Text mt={2} color='whiteAlpha.600' fontSize={14}>
                        RandomJudge 可用于在评测前随机生成一组数据点。
                      </Text> }
                    </GridItem>
                    <GridItem colSpan={1}>
                      <HStack>
                        <Text fontSize={14}>
                          启用 SpecialJudge
                        </Text>
                        <Switch isChecked={(objective.mode & 0b010) !== 0} onChange={() => {
                          objective.mode ^= 0b010;
                          if (objective.mode & 0b001) {
                            objective.mode ^= 0b001;
                          }
                          setUnit({...unit});
                        }}></Switch>
                      </HStack>
                      { objective.mode & 0b010 ?
                      <Box mt={2}>
                        <CodeMirror
                          style={{ flexGrow: 1 }}
                          theme={vscodeDark}
                          extensions={[ langs.lua() ]} 
                          basicSetup={{ lineNumbers: true, tabSize: 4 }}
                          value={objective.sScript}
                          onChange={val => {
                            objective.sScript = val;
                            setUnit({...unit});
                          }}
                          />
                      </Box>
                      : 
                      <Text mt={2} color='whiteAlpha.600' fontSize={14}>
                        用户与样例输出将以参数传入 SpecialJudge，以达到自定义评测的效果。<br/>
                        Strict 和 SpecialJudge 不兼容。
                      </Text> }
                    </GridItem>
                  </Grid>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        }
      </GridItem>
    </Grid>
    <AlertDialog leastDestructiveRef={cancelRef} isCentered isOpen={deleter.isOpen} onClose={deleter.onClose}>
      <AlertDialogOverlay backdropFilter='blur(5px)'/>
      <AlertDialogContent>
        <AlertDialogCloseButton/>
        <AlertDialogHeader>删除问题</AlertDialogHeader>
        <AlertDialogBody display='flex' gap={2}>
          <Box>
            <IconExclamationCircle size={50} strokeWidth={1.5}/>
          </Box>
          <Box>
            <Text>确定要删除问题 "#{ active+1 } { objective?.name }" 吗？</Text>
            <Text>此操作不可撤回。</Text>
          </Box>
        </AlertDialogBody>
        <AlertDialogFooter gap={2}>
          <Button ref={cancelRef} onClick={deleter.onClose}>取消</Button>
          <Button colorScheme='red' onClick={() => {
            deleter.onClose();
            unit.objectives.splice(active, 1);
            setUnit({...unit});
            setActive(active-1);
          }}>确定</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog leastDestructiveRef={cancelWholeRef} isCentered isOpen={remover.isOpen} onClose={remover.onClose}>
      <AlertDialogOverlay backdropFilter='blur(5px)'/>
      <AlertDialogContent>
        <AlertDialogCloseButton/>
        <AlertDialogHeader>删除单元</AlertDialogHeader>
        <AlertDialogBody display='flex' gap={2}>
          <Box>
            <IconExclamationCircle size={50} strokeWidth={1.5}/>
          </Box>
          <Box>
            <Text>确定要删除此单元吗？</Text>
            <Text>此操作不可撤回。</Text>
          </Box>
        </AlertDialogBody>
        <AlertDialogFooter gap={2}>
          <Button ref={cancelWholeRef} onClick={remover.onClose}>取消</Button>
          <Button colorScheme='red' onClick={() => {
            remover.onClose();
            backend.removeUnit(id!).then(() => navigate('/'));
          }}>确定</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

export default DesignPage;

export const Head: HeadFC = () => <title>设计 | Z.OJ</title>;