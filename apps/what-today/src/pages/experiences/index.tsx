import {
  AddressInput,
  BannerInput,
  Button,
  DatePicker,
  Input,
  IntroduceInput,
  MinusIcon,
  PlusIcon,
  Select,
  TimePicker,
} from '@what-today/design-system';
import { type Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import axiosInstance from '@/apis/axiosInstance';
import { createActivity, patchActivity } from '@/apis/experiences';
import { activityWithSchedulesResponseSchema, categoryEnum, createActivityBodySchema } from '@/schemas/experiences';

type Schedule = {
  date: Dayjs | null;
  startTime: { hour: string; minute: string } | null;
  endTime: { hour: string; minute: string } | null;
};

const formatTime = (time: { hour: string | number; minute: string | number } | null): string => {
  if (!time || time.hour == null || time.minute == null) return '00:00';
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
};

export default function CreateExperience() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [selectedValue, setSelectedValue] = useState<{ value: string; label: React.ReactNode } | null>(null);
  const [text, setText] = useState('');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([{ date: null, startTime: null, endTime: null }]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [subImageFiles, setSubImageFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;

    const fetch = async () => {
      try {
        const res = await axiosInstance.get(`/activities/${id}`);
        const safeData = {
          ...res.data,
          schedules: res.data.schedules.map((s: any) => ({
            ...s,
            times: s.times ?? [],
          })),
        };

        const parsed = activityWithSchedulesResponseSchema.parse(safeData);

        setTitle(parsed.title);
        setText(parsed.description);
        setPrice(String(parsed.price));
        setAddress(parsed.address);
        setSelectedValue({ value: parsed.category, label: parsed.category });

        setSchedules(
          parsed.schedules.length > 0
            ? parsed.schedules.flatMap((s) =>
                (s.times.length > 0 ? s.times : [{ startTime: '', endTime: '' }]).map((t) => ({
                  date: dayjs(s.date),
                  startTime: t.startTime
                    ? {
                        hour: t.startTime.split(':')[0].padStart(2, '0'),
                        minute: t.startTime.split(':')[1].padStart(2, '0'),
                      }
                    : null,
                  endTime: t.endTime
                    ? {
                        hour: t.endTime.split(':')[0].padStart(2, '0'),
                        minute: t.endTime.split(':')[1].padStart(2, '0'),
                      }
                    : null,
                })),
              )
            : [{ date: null, startTime: null, endTime: null }],
        );
        console.log(parsed.schedules);
      } catch (err) {
        console.error('체험 수정 데이터 불러오기 실패:', err);
      }
    };

    fetch();
  }, [id]);

  const handleAddSchedule = () => {
    setSchedules((prev) => [...prev, { date: null, startTime: null, endTime: null }]);
  };

  const handleRemoveSchedule = (indexToRemove: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await axiosInstance.post(`/activities/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.activityImageUrl;
  };

  const handleSubmit = async () => {
    try {
      if (!selectedValue) {
        alert('카테고리를 선택해주세요.');
        return;
      }

      for (const s of schedules) {
        if (!s.date || !s.startTime?.hour || !s.startTime?.minute || !s.endTime?.hour || !s.endTime?.minute) {
          alert('날짜와 시작/종료 시간을 모두 정확히 입력해주세요.');
          return;
        }
      }

      setLoading(true);

      const newBannerUrl = bannerFile ? await uploadImage(bannerFile) : undefined;
      const newSubImageUrls = await Promise.all(subImageFiles.map(uploadImage));

      const flattenedSchedules = schedules.map((s) => ({
        date: dayjs(s.date).format('YYYY-MM-DD'),
        startTime: formatTime(s.startTime),
        endTime: formatTime(s.endTime),
      }));

      if (isEdit) {
        const updatePayload = {
          ...(title && { title }),
          ...(selectedValue && { category: categoryEnum.parse(selectedValue.value) }),
          ...(text && { description: text }),
          ...(address && { address }),
          ...(price && { price: Number(price.trim()) }),
          ...(newBannerUrl && { bannerImageUrl: newBannerUrl }),
          subImageUrlsToAdd: newSubImageUrls,
          schedulesToAdd: flattenedSchedules,
          subImageIdsToRemove: [],
          scheduleIdsToRemove: [],
        };

        await patchActivity(Number(id), updatePayload);
      } else {
        const payload = {
          title,
          category: selectedValue.value,
          description: text,
          address,
          price: Number(price.trim()),
          schedules: flattenedSchedules,
          bannerImageUrl: newBannerUrl!,
          subImageUrls: newSubImageUrls,
        };
        createActivityBodySchema.parse(payload);
        await createActivity(payload);
        console.log('📦 payload:', payload);
      }

      navigate(`/`);
    } catch (err) {
      console.error(isEdit ? '체험 수정 실패:' : '체험 등록 실패:', err);
      alert(isEdit ? '수정에 실패했습니다.' : '등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mt-40'>
      <div className='flex flex-col gap-40'>
        {/* 제목 */}
        <Input.Root className='w-full gap-10'>
          <Input.Label>제목</Input.Label>
          <Input.Wrapper>
            <Input.Field
              className='py-5'
              placeholder='제목을 입력해 주세요'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Input.Wrapper>
        </Input.Root>

        {/* 카테고리 */}
        <Select.Root className='flex flex-col gap-10' value={selectedValue} onChangeValue={setSelectedValue}>
          <Select.Title className='font-normal'>카테고리</Select.Title>
          <Select.Trigger className='py-15'>
            <Select.Value className='flex' placeholder='카테고리를 선택해 주세요' />
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              <Select.Label>카테고리</Select.Label>
              <Select.Item value='문화 · 예술'>문화 예술</Select.Item>
              <Select.Item value='식음료'>식음료</Select.Item>
              <Select.Item value='스포츠'>스포츠</Select.Item>
              <Select.Item value='투어'>투어</Select.Item>
              <Select.Item value='관광'>관광</Select.Item>
              <Select.Item value='웰빙'>웰빙</Select.Item>
            </Select.Group>
          </Select.Content>
        </Select.Root>

        {/* 설명 */}
        <Input.Root className='flex w-full gap-10' size='md'>
          <Input.Label>설명</Input.Label>
          <Input.Wrapper>
            <Input.Textarea
              autoHeight
              className='min-h-200'
              placeholder='체험에 대한 설명을 입력해 주세요.'
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Input.Wrapper>
        </Input.Root>

        {/* 가격 */}
        <Input.Root className='flex w-full gap-10'>
          <Input.Label>가격</Input.Label>
          <Input.Wrapper>
            <Input.Field
              className='p-5'
              placeholder='가격을 입력해주세요'
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Input.Wrapper>
        </Input.Root>

        {/* 주소 */}
        <AddressInput onChange={setAddress} />

        {/* 날짜/시간 반복 */}
        <div className='flex flex-col gap-20'>
          {schedules.map((schedule, index) => (
            <div key={index} className='grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_auto]'>
              <DatePicker
                value={schedule.date}
                onChange={(newDate) =>
                  setSchedules((prev) => prev.map((s, i) => (i === index ? { ...s, date: newDate } : s)))
                }
              />
              <div className='flex items-center gap-10'>
                <TimePicker
                  value={schedule.startTime}
                  onChange={(newVal) =>
                    setSchedules((prev) =>
                      prev.map((s, i) =>
                        i === index
                          ? {
                              ...s,
                              startTime: typeof newVal === 'function' ? newVal(s.startTime) : newVal,
                            }
                          : s,
                      ),
                    )
                  }
                />
                <TimePicker
                  value={schedule.endTime}
                  onChange={(newVal) =>
                    setSchedules((prev) =>
                      prev.map((s, i) =>
                        i === index
                          ? {
                              ...s,
                              endTime: typeof newVal === 'function' ? newVal(s.endTime) : newVal,
                            }
                          : s,
                      ),
                    )
                  }
                />
                <div>
                  {index === 0 ? (
                    <Button
                      className='flex h-fit w-fit cursor-pointer items-center rounded-full bg-blue-400 p-10'
                      size='xs'
                      variant='none'
                      onClick={handleAddSchedule}
                    >
                      <PlusIcon className='size-20' color='white' />
                    </Button>
                  ) : (
                    <Button
                      className='flex h-fit w-fit cursor-pointer items-center rounded-full bg-gray-300 p-10'
                      size='xs'
                      variant='none'
                      onClick={() => handleRemoveSchedule(index)}
                    >
                      <MinusIcon className='size-20' color='white' />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 이미지 업로드 */}
        <div className='flex flex-col gap-20'>
          <div className=''>
            <h3 className='text-lg font-bold'>배너 이미지 등록</h3>
            <BannerInput onChange={setBannerFile} />
          </div>
          <div>
            <h3 className='text-lg font-bold'>소개 이미 등록</h3>
            <IntroduceInput onChange={setSubImageFiles} />
          </div>
        </div>

        {/* 등록 버튼 */}
        <div className='flex justify-center'>
          <Button className='w-138' disabled={loading} size='sm' variant='fill' onClick={handleSubmit}>
            {loading ? '등록 중...' : '등록하기'}
          </Button>
        </div>
      </div>
    </div>
  );
}
