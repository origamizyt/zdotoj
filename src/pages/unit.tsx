import { HeadFC, PageProps } from "gatsby";
import { Navbar } from "../components/Navbar";
import { ObjectiveInfo, Reason, Result, Status, Unit, backend, formatLanguage, getLanguageId, formatMode, formatReason, initialCode, render, parseQuery } from "../frontend/api";
import { AlertDialog, AlertDialogBody, AlertDialogCloseButton, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Box, Button, ButtonGroup, Card, CardBody, CircularProgress, CircularProgressLabel, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, Grid, GridItem, HStack, IconButton, Modal, ModalBody, ModalContent, ModalOverlay, Spinner, Stack, StatHelpText, Text, useDisclosure } from "@chakra-ui/react";
import React from "react";
import { IconCheck, IconCircleFilled, IconExclamationCircle, IconPlayerPlayFilled, IconPlayerSkipBackFilled, IconX } from "@tabler/icons-react";
import AniLink from "gatsby-plugin-transition-link/AniLink";
import '../styles/markdown.css';
import '../styles/codemirror.css';
import Difficulty from "../components/Difficulty";
import CodeMirror from '@uiw/react-codemirror'
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { langs, loadLanguage } from "@uiw/codemirror-extensions-langs";
import { height, width } from '../frontend/const';

interface State {
  staged: boolean
  code: string[],
  results?: Result[]
  passed: number
  total: number
}

const sum = (a: number, b: number) => a + b;

const UnitPage: React.FC<PageProps> = props => {
  const [unit, setUnit] = React.useState<Unit<ObjectiveInfo>>();
  const [error, setError] = React.useState<Reason>();
  const [states, setStates] = React.useState<State[]>([]);
  const [selected, setSelected] = React.useState(-1);
  const [lines, setLines] = React.useState(0);
  const [switchTo, setSwitchTo] = React.useState(-1);
  const [queuePos, setQueuePos] = React.useState(-1);
  const unsavedAlert = useDisclosure();
  const runner = useDisclosure();
  const errorDrawer = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const query = parseQuery(props.location.search);
    backend.fetchUnit(query.id)
    .then(unit => {
      setUnit(unit);
      const states = unit.objectives.map(obj => ({
        staged: false,
        code: initialCode(obj.template),
        passed: 0,
        total: obj.pointCount
      }));
      backend.fetchRecord(unit.id).then(record => {
        states.forEach((state, index) => {
          if (record.entries[index].code) {
            state.passed = record.entries[index].passed;
            state.code = record.entries[index].code as string[];
          }
        });
        setStates(states);
        setSelected(0);
      }).catch(reason => {
        if (reason.category === 'object' && reason.id == 'notFound') {
          setStates(states);
          setSelected(0);
        }
        else setError(reason);
      });
    })
    .catch(setError);
    // TODO: fetch records
  }, [])
  React.useEffect(() => {
    if (!unit) return;
    let tei = 0;
    setLines(
      unit.objectives[selected].template.map(region => {
        if (region.editable) return states[selected].code[tei++];
        return region.content;
      }).map(s => s.split('\n').length).reduce(sum)
    );
  }, [selected]);
  const state = selected >= 0 && states[selected];
  const objective = selected >= 0 && unit?.objectives[selected];
  let editableIndex = 0;
  return <>
    <Box h='100%'>
      <Navbar/>
      {
        error ? 
        <Stack h='calc(100vh - 75px - .5rem)' justify='center'>
          <Box textAlign='center'>
            <IconExclamationCircle style={{ display: 'inline-block' }} size={60} color='var(--chakra-colors-red-400)'/>
            <Text fontSize={25} fontWeight={600}>
              获取单元信息时出错
            </Text>
            <Text fontFamily='monospace' mt={1} mb={2}>
              {formatReason(error)}
            </Text>
            <AniLink to='/' cover direction='up' bg='#222230'>
              <Button variant='outline'>返回首页</Button>
            </AniLink>
          </Box>
        </Stack>
        : undefined
      }
      {
        states.length > 0 && unit ?
        <Grid templateRows='repeat(3, 1fr)' templateColumns='repeat(8, 1fr)' h='calc(100vh - 75px - .5rem)'>
          <GridItem colSpan={2} rowSpan={2} borderBottomWidth={1} borderBottomColor='whiteAlpha.50'>
            <Stack h='100%' overflowY='auto' gap={0} fontSize={14} py={2}>
              <Text 
                textTransform='uppercase' px={2} fontSize={12} 
                fontWeight={600} color='whiteAlpha.500'
                letterSpacing='0.05em' userSelect='none'>Objectives</Text>
              {
                unit.objectives.map((obj, index) => 
                <HStack px={2} py={1} key={index} cursor='pointer' 
                  bg={selected === index ? 'whiteAlpha.200' : undefined}
                  _hover={{ bg: 'whiteAlpha.50' }} 
                  _active={{ bg: 'whiteAlpha.200' }}
                  onClick={() => {
                    if ((state as State).staged) {
                      setSwitchTo(index);
                      unsavedAlert.onOpen();
                    }
                    else {
                      setSelected(index);
                    }
                  }}>
                  <Box w={3}>
                    {
                      states[index].staged ?
                      <span title='有未提交的更改'>
                        <IconCircleFilled size={10}/>
                      </span>
                      : undefined
                    }
                  </Box>
                  <Box flexGrow={1}>
                    {obj.name}
                  </Box>
                  <Box w={3}>
                    {
                      states[index].passed === 0 ?
                      undefined :
                      states[index].passed < states[index].total ?
                      <IconX size={12} color='red' stroke={3}/>
                      :
                      <IconCheck size={12} color='green' stroke={3}/>
                    }
                  </Box>
                </HStack>)
              }
              
            </Stack>
          </GridItem>
          <GridItem colSpan={3} rowSpan={3} p={5} overflowY='auto' borderLeftWidth={1} borderRightWidth={1} borderColor='whiteAlpha.50'>
            {
              objective ?
              <Box>
                <Text fontWeight={600} fontSize={25}>任务 #{selected+1}: {objective.name}</Text>
                <HStack fontSize={12} color='whiteAlpha.700' display='flex' gap={3} mb={4}>
                  <HStack gap={0}>
                    <Text>  
                      难度：
                    </Text>
                    <Difficulty value={objective.difficulty} postfix/>
                  </HStack>
                  <Text>
                    编程语言：{formatLanguage(objective.language)}
                  </Text>
                  <Text>
                    模式：{formatMode(objective.mode)}
                  </Text>
                </HStack>
                <div dangerouslySetInnerHTML={{ __html: render(objective.description) }} className="md"></div>
              </Box>
              : undefined
            }
          </GridItem>
          <GridItem colSpan={3} rowSpan={3} overflowY='auto' bg='#1e1e1e' pt={1}>
            <HStack gap={0}>
              <Box px={2} justifySelf='flex-start' mt='1.5px'>
                { 
                  new Array(lines).fill(0).map((_, index) => 
                    <Text fontFamily='var(--mono-font)' fontSize={14} h={height} key={index}>{index+1}</Text>
                  )
                }
              </Box>
              <Box flexGrow={1}>
                {
                  objective && state ?
                  objective.template.map((region, index) => {
                    const ei = region.editable ? editableIndex++ : 0;
                    return <HStack gap={0} key={index}>
                      <Box w={`${region.indent*width}px`}></Box>
                      <CodeMirror
                        editable={region.editable}
                        style={{ flexGrow: 1 }}
                        theme={vscodeDark} 
                        value={region.editable ? (state as State).code[ei] : region.content}
                        extensions={[ loadLanguage(getLanguageId(objective.language) as keyof typeof langs)! ]} 
                        basicSetup={{ lineNumbers: false, tabSize: 4 }}
                        onChange={value => {
                          (state as State).code[ei] = value;
                          let tei = 0;
                          setLines(
                            objective.template.map(region => {
                              if (region.editable) return (state as State).code[tei++];
                              return region.content;
                            }).map(s => s.split('\n').length).reduce(sum)
                          );
                          if (!(state as State).staged) {
                            (state as State).staged = true;
                            setStates([...states]);
                          }
                        }}/>
                    </HStack>
                  }
                  ): undefined
                }
              </Box>
            </HStack>
          </GridItem>
          <GridItem colSpan={2} rowSpan={1}>
            <HStack px={2} pt={2}>
              <Text
                  textTransform='uppercase' fontSize={12} 
                  fontWeight={600} color='whiteAlpha.500'
                  letterSpacing='0.05em' userSelect='none'
                  alignSelf='start'
                  flexGrow={1}>Execution</Text>
              <ButtonGroup isAttached size='sm'>
                <IconButton aria-label="run" icon={<IconPlayerPlayFilled/>} title='运行程序' onClick={async () => {
                  const code = (state as State).code;
                  runner.onOpen();
                  for await (const message of backend.watchedRun((unit as Unit<ObjectiveInfo>).id, selected, code)) {
                    if (message.position >= 0) setQueuePos(message.position);
                    else {
                      runner.onClose();
                      (state as State).results = message.results;
                      (state as State).passed = message.results!.filter(r => r.code === Status.OK).length;
                      (state as State).staged = false;
                    }
                  }
                }}/>
                <IconButton aria-label="run" icon={<IconPlayerSkipBackFilled/>} title='回退到通过率最高的版本' onClick={async () => {
                  const entry = await backend.fetchRecordEntry(unit.id, selected);
                  if (entry.code != null) {
                    (state as State).code = entry.code;
                    (state as State).passed = entry.passed;
                    (state as State).results = undefined;
                  }
                  setStates([...states]);
                  let tei = 0;
                  setLines(
                    (objective as ObjectiveInfo).template.map(region => {
                      if (region.editable) return states[selected].code[tei++];
                      return region.content;
                    }).map(s => s.split('\n').length).reduce(sum)
                  );
                }}/>
              </ButtonGroup>
            </HStack>
            <Box p={5}>
              { state ? 
                <>
                  <Grid templateColumns='repeat(2, 1fr)'>
                    <GridItem colSpan={1}>
                      <Text fontSize={20} fontWeight={600} textAlign='center'>通过率</Text>
                      <HStack justify='center'>
                        <CircularProgress size='100px' thickness={4} value={state.passed/state.total*100} color='green'>
                          <CircularProgressLabel>
                            <Text fontSize={18} lineHeight={1}>
                              {(state.passed / state.total * 100).toFixed(1)}%
                            </Text>
                            <Text fontSize={12} lineHeight={1}>
                              {state.passed} of {state.total}
                            </Text>
                          </CircularProgressLabel>
                        </CircularProgress>
                      </HStack>
                    </GridItem>
                    <GridItem colSpan={1}>
                      <Text fontSize={20} fontWeight={600} textAlign='center'>状态</Text>
                      <Text textAlign='center' mt='30px' fontSize={20}>
                        { state.results ? 
                        state.results.length === 1 && state.results[0].code === Status.CE ? 
                        <Text as='span' color='red.300'>
                          编译错误
                        </Text>:
                        state.results.every(r => r.code === Status.OK) ? 
                        <Text as='span' color='green.300'>
                          通过
                        </Text> : 
                        <Text as='span' color='red.300'>
                          未通过
                        </Text>
                        : 
                        <Text as='span' color='blue.300'>
                          未测试
                        </Text>}
                      </Text>
                    </GridItem>
                  </Grid>
                </>
              : undefined
              }
              <Button w='100%' mt={3} isDisabled={!state || !state.results || state.results.every(r => r.code === Status.OK)}
                onClick={errorDrawer.onOpen}>查看错误</Button>
            </Box>
          </GridItem>
        </Grid>
        : undefined
      }
    </Box>
    <AlertDialog 
      onClose={unsavedAlert.onClose} 
      isOpen={unsavedAlert.isOpen} 
      leastDestructiveRef={cancelRef}
      isCentered>
        <AlertDialogOverlay backdropFilter='blur(5px)'/>
        <AlertDialogContent>
          <AlertDialogHeader>未提交的更改</AlertDialogHeader>
          <AlertDialogCloseButton/>
          <AlertDialogBody>
            当前题目 "#{selected+1} {objective && objective.name}" 有未提交的代码重构。
            确定要切换题目吗？
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button onClick={unsavedAlert.onClose} mr={3}>取消</Button>
            <Button colorScheme="red" onClick={() => {
              setSelected(switchTo);
              setSwitchTo(-1);
              unsavedAlert.onClose();
            }}>确定</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    <Modal isOpen={runner.isOpen} onClose={runner.onClose} isCentered closeOnEsc={false} closeOnOverlayClick={false}>
      <ModalOverlay backdropFilter='blur(5px)'/>
      <ModalContent bg='transparent' boxShadow='none'>
        <ModalBody textAlign='center'>
          <Spinner size='xl' mb={2}/>
          <Text fontWeight={600} fontSize={25}>
            {
              queuePos > 0 ? `正在队列中等待，位置 ${queuePos}。` : "正在运行..."
            }
          </Text>
        </ModalBody>
      </ModalContent>
    </Modal>
    <Drawer isOpen={errorDrawer.isOpen} onClose={errorDrawer.onClose} size='full'>
      <DrawerOverlay/>
      <DrawerContent>
        <DrawerCloseButton/>
        <DrawerHeader>错误查看</DrawerHeader>
        <DrawerBody>
          {
            state && state.results ? 
            state.results.length === 1 && state.results[0].code === Status.CE ? 
            <>
              <Text fontWeight={600}>
                Compiler "{state.results[0].data.compiler}" exited with code {state.results[0].data.exitCode}.
              </Text>
              <pre><code style={{ fontFamily: 'var(--mono-font)' }}>{ state.results[0].data.error }</code></pre>
            </>
            : 
            <HStack flexWrap='wrap' alignItems='stretch'>
              {
                state.results.map((result, index) => 
                <Card key={index} w='calc((100% - 2.5rem) / 6)' bg='whiteAlpha.50'>
                  <CardBody>
                    <HStack justify='space-between'>
                      <Text fontWeight={600}>#{index+1}</Text>
                      <Text>
                        {
                          result.code === Status.IE ? <Text as='span' color='red.300'>IE</Text> :
                          result.code === Status.WA ? <Text as='span' color='red.300'>WA</Text> :
                          result.code === Status.OK ? <Text as='span' color='green.300'>OK</Text> :
                          result.code === Status.RE ? <Text as='span' color='yellow.300'>RE</Text> :
                          result.code === Status.TLE ? <Text as='span' color='yellow.300'>TLE</Text> : 
                          result.code === Status.MLE ? <Text as='span' color='yellow.300'>MLE</Text> : 
                          result.code === Status.SE ? <Text as='span' color='yellow.300'>SE</Text> : undefined
                        }
                      </Text>
                    </HStack>
                    <Box fontSize={14}>
                      {
                        result.code === Status.IE ? <Text as='span'>内部错误：{result.data}</Text> :
                        result.code === Status.WA ? <>
                          <Text>
                            期望：
                          </Text>
                          <pre><code style={{ fontFamily: 'var(--mono-font)' }}>{ result.data.expected }</code></pre>
                          <Text>
                            得到：
                          </Text>
                          {
                            result.data.got.length ?
                            <pre><code style={{ fontFamily: 'var(--mono-font)' }}>{ result.data.got }</code></pre>:
                            <Text fontSize={12} color='whiteAlpha.600'>你的程序没有输出。</Text>
                          }
                        </> :
                        result.code === Status.OK ? <Text as='span'>
                          通过测试点，耗费{(result.data.execTime*1000).toFixed(1)}ms，{result.data.execMemory/1000} KB
                        </Text> :
                        result.code === Status.RE ? <Text as='span'>
                          运行时错误，终止信号：{result.data.termsig}
                        </Text> :
                        result.code === Status.TLE ? <Text as='span'>
                          超时。
                        </Text> : 
                        result.code === Status.MLE ? <Text as='span'>
                          超出内存限制。
                        </Text> : 
                        result.code === Status.SE ? <Text as='span'>
                          检测到恶意代码，系统调用号：{result.data.syscall}
                        </Text> : undefined
                      }
                    </Box>
                  </CardBody>
                </Card>
                )
              }
            </HStack>
            : undefined
          }
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  </>
}

export default UnitPage;

export const Head: HeadFC = () => <title>单元 | Z.OJ</title>;