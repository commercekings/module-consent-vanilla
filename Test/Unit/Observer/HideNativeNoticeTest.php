<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\Test\Unit\Observer;

use CommerceKings\ConsentVanilla\ViewModel\Banner;
use CommerceKings\ConsentVanilla\Observer\HideNativeNotice;
use Magento\Framework\Event\Observer;
use Magento\Framework\View\Layout\ProcessorInterface;
use Magento\Framework\View\LayoutInterface;
use PHPUnit\Framework\TestCase;

class HideNativeNoticeTest extends TestCase
{
    /** @return array<string, array{bool, bool}> */
    public static function configurations(): array
    {
        return [
            'Hyva, active source with optional choices' => [true, true],
            'Hyva, no active banner' => [true, false],
            'Luma, active source' => [false, true],
            'Luma, no active banner' => [false, false],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('configurations')]
    public function testOnlyTheActiveHyvaSourceReplacesTheNativeNotice(bool $hyva, bool $enabled): void
    {
        $update = $this->createStub(ProcessorInterface::class);
        $update->method('getHandles')->willReturn($hyva ? ['default', 'hyva_default'] : ['default']);
        $layout = $this->createMock(LayoutInterface::class);
        $layout->method('getUpdate')->willReturn($update);
        $layout->expects($hyva && $enabled ? $this->once() : $this->never())
            ->method('unsetElement')->with('cookie_notices');
        $banner = $this->createStub(Banner::class);
        $banner->method('isEnabled')->willReturn($enabled);

        (new HideNativeNotice($banner))->execute(new Observer(['layout' => $layout]));
    }

    public function testAnEventWithoutALayoutDoesNothing(): void
    {
        $banner = $this->createMock(Banner::class);
        $banner->expects($this->never())->method('isEnabled');
        (new HideNativeNotice($banner))->execute(new Observer());
    }
}
